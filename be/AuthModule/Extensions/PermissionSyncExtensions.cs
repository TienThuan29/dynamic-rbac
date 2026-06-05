using AuthModule.Attributes;
using AuthModule.Dal.Entities;
using AuthModule.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Extensions;

/// <summary>
/// Handles database reads/writes for permission synchronization.
/// Kept separate from the endpoint-scanning logic so the two concerns
/// (route introspection vs. persistence) can be unit-tested independently.
/// </summary>
public class PermissionSyncService
{
    private readonly AuthDbContext _db;

    public PermissionSyncService(AuthDbContext db)
    {
        _db = db;
    }

    public async Task<HashSet<string>> GetExistingEndpointKeysAsync(CancellationToken ct = default)
    {
        var existing = await _db.Permissions
            .AsNoTracking()
            .Where(p => p.Endpoint != null && p.Method != null)
            .Select(p => new { p.Endpoint, p.Method })
            .ToListAsync(ct);

        return existing
            .Select(p => $"{p.Method!.ToUpperInvariant()}:{p.Endpoint!.ToLowerInvariant()}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public async Task<List<string>> GetExistingCodesAsync(CancellationToken ct = default)
    {
        return await _db.Permissions
            .AsNoTracking()
            .Where(p => p.PermissionCode != null)
            .Select(p => p.PermissionCode!)
            .ToListAsync(ct);
    }

    public async Task InsertPermissionsAsync(List<Permission> permissions, CancellationToken ct = default)
    {
        if (permissions.Count == 0) return;
        await _db.Permissions.AddRangeAsync(permissions, ct);
        await _db.SaveChangesAsync(ct);
    }
}


// ---------------------------------------------------------------------------


public static class PermissionSyncExtensions
{
    private static readonly string[] SkippedPrefixes =
        ["/swagger", "/openapi", "/health", "/favicon", "/_"];

    /// <summary>
    /// Scans all registered RouteEndpoints and upserts missing records into the
    /// permissions table. Existing rows are left untouched.
    /// </summary>
    public static async Task SyncEndpointPermissionsAsync(this WebApplication app)
    {
        var logger = app.Services.GetRequiredService<ILogger<WebApplication>>();

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        var syncService = new PermissionSyncService(db);

        var routeBuilder = (IEndpointRouteBuilder)app;
        var allEndpoints = routeBuilder.DataSources.SelectMany(ds => ds.Endpoints);

        // Load existing (endpoint, method) pairs
        var existingSet = await syncService.GetExistingEndpointKeysAsync();

        // Discover routes and build new permission entities
        var toInsert = new List<Permission>();

        foreach (var endpoint in allEndpoints)
        {
            if (endpoint is not RouteEndpoint routeEndpoint)
                continue;

            var rawPattern = routeEndpoint.RoutePattern.RawText;
            if (string.IsNullOrWhiteSpace(rawPattern))
                continue;

            var normalizedPath = rawPattern.StartsWith('/') ? rawPattern : "/" + rawPattern;

            if (ShouldSkip(normalizedPath))
                continue;

            var httpMethods = endpoint.Metadata
                .GetMetadata<HttpMethodMetadata>()?.HttpMethods;

            if (httpMethods is null || httpMethods.Count == 0)
                continue;

            var meta = endpoint.Metadata.GetOrderedMetadata<PermissionMetaAttribute>().LastOrDefault();
            var isSystem = meta?.IsSystem ?? false;
            var isPublic = meta?.Public switch
            {
                PublicMode.Public => true,
                PublicMode.Private => false,
                _ => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null
            };

            foreach (var method in httpMethods)
            {
                var key = BuildKey(normalizedPath, method);
                if (!existingSet.Add(key))
                    continue;

                toInsert.Add(new Permission
                {
                    Id = Guid.NewGuid(),
                    Endpoint = normalizedPath,
                    Method = method.ToUpperInvariant(),
                    IsPublic = isPublic,
                    IsSystem = isSystem,
                    IsActive = true,
                    PermissionCode = meta?.Code
                        ?? (meta?.AutoGenerateCode == true ? GeneratePermissionCode(normalizedPath, method) : null),
                    PermissionName = meta?.PermissionName,
                    Description = meta?.Description,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        // Bulk insert new rows
        if (toInsert.Count == 0)
        {
            logger.LogInformation("[PermissionSync] No new endpoints to sync.");
        }
        else
        {
            await syncService.InsertPermissionsAsync(toInsert);

            logger.LogInformation("[PermissionSync] Synced {Count} new endpoint(s) to permissions table.", toInsert.Count);

            foreach (var p in toInsert)
                logger.LogDebug("[PermissionSync]   + {Method,-7} {Endpoint}  (public={IsPublic})", p.Method, p.Endpoint, p.IsPublic);
        }

        // Sync admin permissions
        await SyncAdminPermissionsAsync(syncService, allEndpoints, logger);
    }

    private static async Task SyncAdminPermissionsAsync(
        PermissionSyncService syncService,
        IEnumerable<Endpoint> endpoints,
        ILogger logger)
    {
        var resources = endpoints
            .OfType<RouteEndpoint>()
            .Select(e => e.RoutePattern.RawText)
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .SelectMany(ExtractResources)
            .Where(r => r is not null)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (resources.Count == 0)
            return;

        var existingCodes = await syncService.GetExistingCodesAsync();
        var existingSet = existingCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var toInsert = resources
            .Select(r => $"{r}:admin")
            .Where(code => existingSet.Add(code))
            .Select(code => new Permission
            {
                Id = Guid.NewGuid(),
                Endpoint = null,
                Method = null,
                PermissionCode = code,
                PermissionName = $"Quản trị {ToNaturalLanguage(NormalizeResourceName(code[":admin".Length..]))}",
                Description = $"Toàn quyền trên {ToNaturalLanguage(NormalizeResourceName(code[":admin".Length..]))}",
                IsPublic = false,
                IsSystem = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (toInsert.Count == 0)
        {
            logger.LogInformation("[PermissionSync] All admin permissions already exist.");
            return;
        }

        await syncService.InsertPermissionsAsync(toInsert);

        logger.LogInformation("[PermissionSync] Synced {Count} admin permission(s): {Codes}",
            toInsert.Count, string.Join(", ", toInsert.Select(p => p.PermissionCode)));
    }

    private static IEnumerable<string?> ExtractResources(string? routePattern)
    {
        if (string.IsNullOrWhiteSpace(routePattern))
            yield break;

        var segments = routePattern.Split('/', StringSplitOptions.RemoveEmptyEntries);

        foreach (var seg in segments)
        {
            if (seg.Equals("api", StringComparison.OrdinalIgnoreCase) ||
                seg.StartsWith('{') || seg.StartsWith(':'))
                continue;

            yield return seg.ToLowerInvariant().Replace("-", "_");
            yield break;
        }
    }

    private static string NormalizeResourceName(string resource) =>
        resource.Replace("_", "-");

    private static string ToNaturalLanguage(string kebabCase) =>
        string.Join(" ", kebabCase.Split('-', StringSplitOptions.RemoveEmptyEntries)
            .Select(word => word.Length > 0
                ? char.ToUpperInvariant(word[0]) + word[1..].ToLowerInvariant()
                : word));

    private static string BuildKey(string endpoint, string method) =>
        $"{method.ToUpperInvariant()}:{endpoint.ToLowerInvariant()}";

    private static bool ShouldSkip(string path) =>
        SkippedPrefixes.Any(prefix => path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

    private static string? GeneratePermissionCode(string path, string method)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Where(s => !s.Equals("api", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (segments.Count == 0) return null;

        var resource = segments.FirstOrDefault(s => !s.StartsWith('{'));
        if (resource is null) return null;

        resource = resource.ToLowerInvariant().Replace("-", "_");

        var hasParams = segments.Any(s => s.StartsWith('{'));

        var resourceIdx = segments.FindIndex(s => !s.StartsWith('{'));
        var trailingSlugs = segments
            .Skip(resourceIdx + 1)
            .Where(s => !s.StartsWith('{'))
            .Select(s => s.ToLowerInvariant().Replace("-", "_"))
            .ToList();

        var action = method.ToUpperInvariant() switch
        {
            "GET" => hasParams ? "read" : "list",
            "POST" => "create",
            "PUT" => "update",
            "PATCH" => "patch",
            "DELETE" => "delete",
            var m => m.ToLowerInvariant()
        };

        var suffix = trailingSlugs.Count > 0 ? "_" + string.Join("_", trailingSlugs) : string.Empty;
        return $"{resource}:{action}{suffix}";
    }
}
