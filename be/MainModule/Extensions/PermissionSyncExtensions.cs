using MainModule.Attributes;
using MainModule.Dal.Entities;
using MainModule.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace MainModule.Extensions;

public static class PermissionSyncExtensions
{
    private static readonly string[] SkippedPrefixes =
        ["/swagger", "/openapi", "/health", "/favicon", "/_"];

    /// <summary>
    /// Scans all registered RouteEndpoints in MainModule and syncs missing records
    /// into the shared <c>permissions</c> table (owned by AuthModule).
    /// Existing rows are never overwritten.
    /// </summary>
    public static async Task SyncEndpointPermissionsAsync(this WebApplication app)
    {
        var logger = app.Services.GetRequiredService<ILogger<WebApplication>>();

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MainDbContext>();

        // Must cast app as IEndpointRouteBuilder to get the actual data sources
        // populated by MapControllers() — resolving EndpointDataSource from DI
        // returns a different, empty instance.
        var routeBuilder = (IEndpointRouteBuilder)app;
        var allEndpoints = routeBuilder.DataSources.SelectMany(ds => ds.Endpoints);

        // --- 1. Batch-load existing keys to avoid N+1 ---
        var existing = await db.Permissions
            .AsNoTracking()
            .Where(p => p.Endpoint != null && p.Method != null)
            .Select(p => new { p.Endpoint, p.Method })
            .ToListAsync();

        var existingSet = existing
            .Select(p => BuildKey(p.Endpoint!, p.Method!))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // --- 2. Discover routes ---
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

            // Method-level attribute takes precedence over class-level (last in ordered metadata)
            var meta = endpoint.Metadata.GetOrderedMetadata<PermissionMetaAttribute>().LastOrDefault();
            var isSystem = meta?.IsSystem ?? false;
            // IsPublic: explicit Public/Private wins; Auto falls back to [AllowAnonymous]
            var isPublic = meta?.Public switch
            {
                PublicMode.Public  => true,
                PublicMode.Private => false,
                _                  => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null
            };

            foreach (var method in httpMethods)
            {
                var key = BuildKey(normalizedPath, method);
                if (!existingSet.Add(key))   // Add returns false if already present (either in DB or batch)
                    continue;

                toInsert.Add(new Permission
                {
                    Id = Guid.NewGuid(),
                    Endpoint = normalizedPath,
                    Method = method.ToUpperInvariant(),
                    IsPublic = isPublic,
                    IsSystem = isSystem,
                    IsActive = true,
                    PermissionCode = meta?.Code ?? (meta?.AutoGenerateCode == true ? GeneratePermissionCode(normalizedPath, method) : null),
                    PermissionName = meta?.PermissionName,
                    Description = meta?.Description,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        // --- 3. Bulk insert ---
        if (toInsert.Count == 0)
        {
            logger.LogInformation("[PermissionSync][MainModule] No new endpoints to sync.");
            return;
        }

        await db.Permissions.AddRangeAsync(toInsert);
        await db.SaveChangesAsync();

        logger.LogInformation("[PermissionSync][MainModule] Synced {Count} new endpoint(s).", toInsert.Count);

        foreach (var p in toInsert)
            logger.LogDebug("[PermissionSync][MainModule]   + {Method,-7} {Endpoint}  (public={IsPublic})", p.Method, p.Endpoint, p.IsPublic);
    }

    private static string BuildKey(string endpoint, string method) =>
        $"{method.ToUpperInvariant()}:{endpoint.ToLowerInvariant()}";

    private static bool ShouldSkip(string path) =>
        SkippedPrefixes.Any(prefix => path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Derives a permission code from the route pattern and HTTP method.
    /// Convention: <c>[resource]:[action][_suffix]</c>
    /// Examples:
    ///   GET  /api/products              -> products:list
    ///   GET  /api/products/{id}         -> products:read
    ///   POST /api/products              -> products:create
    ///   PUT  /api/products/{id}         -> products:update
    ///   DEL  /api/products/{id}         -> products:delete
    ///   PATCH /api/products/{id}/stock  -> products:patch_stock
    /// </summary>
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

        // Trailing non-param segments after the resource (e.g. "stock" in /api/products/{id}/stock)
        var resourceIdx = segments.FindIndex(s => !s.StartsWith('{'));
        var trailingSlugs = segments
            .Skip(resourceIdx + 1)
            .Where(s => !s.StartsWith('{'))
            .Select(s => s.ToLowerInvariant().Replace("-", "_"))
            .ToList();

        var action = method.ToUpperInvariant() switch
        {
            "GET"    => hasParams ? "read" : "list",
            "POST"   => "create",
            "PUT"    => "update",
            "PATCH"  => "patch",
            "DELETE" => "delete",
            var m    => m.ToLowerInvariant()
        };

        var suffix = trailingSlugs.Count > 0 ? "_" + string.Join("_", trailingSlugs) : string.Empty;
        return $"{resource}:{action}{suffix}";
    }
}
