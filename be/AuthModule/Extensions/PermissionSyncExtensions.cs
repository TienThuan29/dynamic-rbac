using AuthModule.Attributes;
using AuthModule.Dal.Entities;
using AuthModule.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Extensions;

public static class PermissionSyncExtensions
{
    // Prefixes of system routes to exclude from permission sync
    private static readonly string[] SkippedPrefixes =
        ["/swagger", "/openapi", "/health", "/favicon", "/_"];

    /// <summary>
    /// Scans all registered RouteEndpoints and upserts missing records into the
    /// <c>permissions</c> table. Existing rows (matched by Method + Endpoint)
    /// are left untouched so admin-managed fields (PermissionCode, PermissionName,
    /// Description) are never overwritten.
    /// </summary>
    public static async Task SyncEndpointPermissionsAsync(this WebApplication app)
    {
        var logger = app.Services.GetRequiredService<ILogger<WebApplication>>();

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

        // Must cast app as IEndpointRouteBuilder to get the actual data sources
        // populated by MapControllers() — resolving EndpointDataSource from DI
        // returns a different, empty instance.
        var routeBuilder = (IEndpointRouteBuilder)app;
        var allEndpoints = routeBuilder.DataSources.SelectMany(ds => ds.Endpoints);

        // --- 1. Load existing (endpoint, method) pairs once — avoids N+1 ---
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
                if (existingSet.Contains(key))
                    continue;

                // Guard against duplicates within the same discovery batch
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
                    PermissionCode = meta?.Code ?? (meta?.AutoGenerateCode == true ? GeneratePermissionCode(normalizedPath, method) : null),
                    PermissionName = meta?.PermissionName,
                    Description = meta?.Description,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        // --- 3. Bulk insert new rows ---
        if (toInsert.Count == 0)
        {
            logger.LogInformation("[PermissionSync] No new endpoints to sync.");
        }
        else
        {
            await db.Permissions.AddRangeAsync(toInsert);
            await db.SaveChangesAsync();

            logger.LogInformation("[PermissionSync] Synced {Count} new endpoint(s) to permissions table.", toInsert.Count);

            foreach (var p in toInsert)
                logger.LogDebug("[PermissionSync]   + {Method,-7} {Endpoint}  (public={IsPublic})", p.Method, p.Endpoint, p.IsPublic);
        }

        // --- 4. Auto-generate [resource]:admin permissions for each discovered resource ---
        await SyncAdminPermissionsAsync(db, allEndpoints, logger);
    }

    /// <summary>
    /// Ensures a <c>[resource]:admin</c> permission row exists for each unique
    /// top-level resource discovered from route patterns (e.g. <c>products:admin</c>
    /// for <c>/api/products/*</c>). Having this permission grants the user full
    /// access to all actions on that resource.
    /// </summary>
    private static async Task SyncAdminPermissionsAsync(
        AuthDbContext db,
        IEnumerable<Microsoft.AspNetCore.Http.Endpoint> endpoints,
        ILogger logger)
    {
        // Extract unique resources: the first non-parameter, non-"api" segment
        var resources = endpoints
            .OfType<RouteEndpoint>()
            .Select(e => e.RoutePattern.RawText)
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .SelectMany(p => ExtractResources(p))
            .Where(r => r is not null)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (resources.Count == 0)
            return;

        // Load existing permission codes
        var existingCodes = await db.Permissions
            .AsNoTracking()
            .Where(p => p.PermissionCode != null)
            .Select(p => p.PermissionCode!)
            .ToListAsync();

        var existingSet = existingCodes
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var toInsert = resources
            .Select(r => $"{r}:admin")
            .Where(code => !existingSet.Contains(code))
            .Select(code => new Permission
            {
                Id = Guid.NewGuid(),
                Endpoint = null,  // admin covers all endpoints under the resource
                Method = null,    // admin covers all HTTP methods
                PermissionCode = code,
                PermissionName = $"Quản trị {NormalizeResourceName(code[":admin".Length..])}",
                Description = $"Toàn quyền trên resource {NormalizeResourceName(code[":admin".Length..])}",
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

        await db.Permissions.AddRangeAsync(toInsert);
        await db.SaveChangesAsync();

        logger.LogInformation("[PermissionSync] Synced {Count} admin permission(s): {Codes}",
            toInsert.Count, string.Join(", ", toInsert.Select(p => p.PermissionCode)));

        // Update in-memory set so the guard below works
        foreach (var p in toInsert)
            existingSet.Add(p.PermissionCode);
    }

    /// <summary>
    /// Extracts the top-level resource name from a route pattern.
    /// /api/products/{id}/stock  →  "products"
    /// /api/users/{id}          →  "users"
    /// </summary>
    private static IEnumerable<string?> ExtractResources(string routePattern)
    {
        var segments = routePattern.Split('/', StringSplitOptions.RemoveEmptyEntries);

        foreach (var seg in segments)
        {
            // Skip "api" and parameter placeholders
            if (seg.Equals("api", StringComparison.OrdinalIgnoreCase) ||
                seg.StartsWith('{') || seg.StartsWith(':'))
                continue;

            yield return seg.ToLowerInvariant().Replace("-", "_");
            yield break; // only the first real segment (the resource)
        }
    }

    private static string NormalizeResourceName(string resource) =>
        resource.Replace("_", "-");

    // -----------------------------------------------------------------------

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
