using System.Security.Claims;
using AuthModule.Attributes;
using AuthModule.Dal.Entities;
using AuthModule.Dal.Repositories;
using AuthModule.DTOs.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthModule.Controllers;

/// <summary>
/// Gatekeeper endpoint used exclusively by the API Gateway to validate JWTs
/// and check user permissions before the Gateway forwards requests to downstream
/// services (e.g. MainModule).
///
/// Supports two token types:
///   - JWT Bearer (internal app / user login) — validated via ValidateJwt + UserPermission
///   - Raw JWT Bearer (external app)         — hashed + looked up in tokens table + TokenPermission
/// </summary>
[ApiController]
[Route("api/gatekeeper")]
[AllowAnonymous]
[PermissionMeta(Public = PublicMode.Public, IsSystem = true,
    PermissionName = "Gatekeeper Check Access",
    Description = "Internal endpoint used by the API Gateway to validate JWTs and check user permissions before forwarding requests to downstream services.")]
public class GatekeeperController : ControllerBase
{
    private readonly IUserPermissionRepository _userPermRepo;
    private readonly IPermissionRepository _permissionRepo;
    private readonly ITokenRepository _tokenRepo;
    private readonly ITokenPermissionRepository _tokenPermRepo;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GatekeeperController> _logger;

    public GatekeeperController(
        IUserPermissionRepository userPermRepo,
        IPermissionRepository permissionRepo,
        ITokenRepository tokenRepo,
        ITokenPermissionRepository tokenPermRepo,
        IConfiguration configuration,
        ILogger<GatekeeperController> logger)
    {
        _userPermRepo = userPermRepo;
        _permissionRepo = permissionRepo;
        _tokenRepo = tokenRepo;
        _tokenPermRepo = tokenPermRepo;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<GatekeeperResponse>> CheckAccess(
        [FromBody] GatekeeperRequest request,
        CancellationToken ct = default)
    {
        var authHeader = request.AuthorizationHeader;

        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Gatekeeper: missing or invalid Authorization header");
            return Ok(GatekeeperResponse.Deny("Missing or invalid Authorization header", 401));
        }

        var rawToken = authHeader["Bearer ".Length..].Trim();
        if (string.IsNullOrEmpty(rawToken))
        {
            _logger.LogWarning("Gatekeeper: empty token");
            return Ok(GatekeeperResponse.Deny("Token is empty", 401));
        }

        // Always look up in DB first: if found, it's an external token (raw JWT stored in tokens table).
        // If not found, validate as a standard internal JWT.
        var token = await _tokenRepo.GetByTokenAsync(rawToken, ct);
        if (token != null)
        {
            return await AuthorizeByExternalTokenAsync(token, request, ct);
        }
        else
        {
            return await AuthorizeByJwtAsync(rawToken, request, ct);
        }
    }

    /// <summary>
    /// Authorizes an internal request using a standard JWT.
    /// Flow: validate JWT → extract claims (userId, accountId, role) → check UserPermission.
    /// </summary>
    private async Task<ActionResult<GatekeeperResponse>> AuthorizeByJwtAsync(
        string token,
        GatekeeperRequest request,
        CancellationToken ct)
    {
        Guid userId;
        Guid accountId;
        string email;
        string role;

        try
        {
            var principal = ValidateJwt(token, out var validationException);
            if (validationException != null)
            {
                _logger.LogWarning(validationException, "Gatekeeper: JWT validation failed");
                return Ok(GatekeeperResponse.Deny("Invalid or expired token", 401));
            }

            var userIdClaim = principal.FindFirst("userId")?.Value ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var accountIdClaim = principal.FindFirst("accountId")?.Value;
            var emailClaim = principal.FindFirst("email")?.Value ?? principal.FindFirst(ClaimTypes.Email)?.Value;
            var roleClaim = principal.FindFirst(ClaimTypes.Role)?.Value ?? principal.FindFirst("role")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out userId))
            {
                _logger.LogWarning("Gatekeeper: missing or invalid userId claim");
                return Ok(GatekeeperResponse.Deny("Token missing valid userId claim", 401));
            }

            if (string.IsNullOrEmpty(accountIdClaim) || !Guid.TryParse(accountIdClaim, out accountId))
            {
                _logger.LogWarning("Gatekeeper: missing or invalid accountId claim");
                return Ok(GatekeeperResponse.Deny("Token missing valid accountId claim", 401));
            }

            email = emailClaim ?? string.Empty;
            role = roleClaim ?? "User";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gatekeeper: unexpected error during token validation");
            return Ok(GatekeeperResponse.Deny("Token validation error", 401));
        }

        var result = await AuthorizeByUserPermissionAsync(accountId, role, request.Method, request.Path, ct);

        if (result.Allowed)
            return Ok(GatekeeperResponse.Allow(userId, accountId, email, role));

        return Ok(GatekeeperResponse.Deny(result.Reason ?? "Access denied", result.StatusCode));
    }

    /// <summary>
    /// Authorizes an external app using a raw JWT stored in the tokens table.
    /// Flow: Token was already looked up by the caller → check IsRevoked + ExpiresAt → check TokenPermission.
    /// </summary>
    private async Task<ActionResult<GatekeeperResponse>> AuthorizeByExternalTokenAsync(
        Token token,
        GatekeeperRequest request,
        CancellationToken ct)
    {
        try
        {
            if (token.IsRevoked)
            {
                _logger.LogWarning("Gatekeeper: external token {TokenId} is revoked", token.Id);
                return Ok(GatekeeperResponse.Deny("Token has been revoked", 401));
            }

            if (token.ExpiresAt.HasValue && token.ExpiresAt < DateTime.UtcNow)
            {
                _logger.LogWarning("Gatekeeper: external token {TokenId} has expired", token.Id);
                return Ok(GatekeeperResponse.Deny("Token has expired", 401));
            }

            // External tokens have no user/account identity — use CreatedBy for the response
            var userId = token.CreatedBy;
            var accountId = token.AccountId ?? token.CreatedBy;

            var result = await AuthorizeByTokenPermissionAsync(token.Id, "ExternalToken", request.Method, request.Path, ct);

            if (result.Allowed)
                return Ok(GatekeeperResponse.Allow(userId, accountId, string.Empty, "ExternalToken"));

            return Ok(GatekeeperResponse.Deny(result.Reason ?? "Access denied", result.StatusCode));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gatekeeper: unexpected error during external token validation");
            return Ok(GatekeeperResponse.Deny("Token validation error", 401));
        }
    }

    /// <summary>
    /// Checks authorization using UserPermission records (for JWT-based / internal auth).
    /// </summary>
    private async Task<AccessResult> AuthorizeByUserPermissionAsync(
        Guid accountId,
        string role,
        string method,
        string path,
        CancellationToken ct)
    {
        var normalizedPath = NormalizePath(path);

        if (role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            return AccessResult.Allow();

        var permission = await FindMatchingPermissionAsync(method, normalizedPath, ct);
        if (permission == null)
            return AccessResult.Deny($"No permission record for {method} {path}");

        if (permission.IsPublic)
            return AccessResult.Allow();

        var now = DateTime.UtcNow;

        if (await _userPermRepo.AnyAsync(accountId, permission.Id, now, ct))
            return AccessResult.Allow();

        var resource = ExtractResource(normalizedPath);
        if (resource != null)
        {
            var adminCode = $"{resource}:admin";
            if (await _userPermRepo.AnyByResourceCodeAsync(accountId, adminCode, now, ct))
            {
                _logger.LogDebug(
                    "Gatekeeper: account {AccountId} allowed (admin {AdminCode}) for {Method} {Path}",
                    accountId, adminCode, method, normalizedPath);
                return AccessResult.Allow();
            }
        }

        _logger.LogWarning(
            "Gatekeeper: account {AccountId} denied for {Method} {Path}",
            accountId, method, normalizedPath);
        return AccessResult.Deny($"Access denied: no permission for {method} {path}");
    }

    /// <summary>
    /// Checks authorization using TokenPermission records (for external-app tokens).
    /// Permissions come exclusively from TokenPermission — no fallback to UserPermission.
    /// Uses PermissionCode as the primary matching key (e.g. "product:list").
    /// Falls back to Endpoint+Method matching if no PermissionCode-based match is found.
    /// </summary>
    private async Task<AccessResult> AuthorizeByTokenPermissionAsync(
        Guid tokenId,
        string role,
        string method,
        string path,
        CancellationToken ct)
    {
        var normalizedPath = NormalizePath(path);

        if (role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            return AccessResult.Allow();

        // 1. Try PermissionCode-based matching (most flexible — assign by "product:list" code)
        var resource = ExtractResource(normalizedPath);
        var action = DeriveAction(method, normalizedPath);
        if (resource != null && action != null)
        {
            var permissionCode = $"{resource}:{action}";
            var allPermissions = await _permissionRepo.GetAllActiveForGatekeeperAsync(null, ct);
            var byCode = allPermissions.FirstOrDefault(p =>
                string.Equals(p.PermissionCode, permissionCode, StringComparison.OrdinalIgnoreCase));

            if (byCode != null)
            {
                if (byCode.IsPublic)
                    return AccessResult.Allow();

                if (await _tokenPermRepo.HasPermissionAsync(tokenId, byCode.Id, ct))
                {
                    _logger.LogDebug(
                        "Gatekeeper: external token {TokenId} allowed via PermissionCode {Code} for {Method} {Path}",
                        tokenId, permissionCode, method, normalizedPath);
                    return AccessResult.Allow();
                }
            }
        }

        // 2. Fall back to Endpoint+Method matching
        var permission = await FindMatchingPermissionAsync(method, normalizedPath, ct);
        if (permission == null)
            return AccessResult.Deny($"No permission record for {method} {path}");

        if (permission.IsPublic)
            return AccessResult.Allow();

        if (await _tokenPermRepo.HasPermissionAsync(tokenId, permission.Id, ct))
        {
            _logger.LogDebug(
                "Gatekeeper: external token {TokenId} allowed via Endpoint match for {Method} {Path}",
                tokenId, method, normalizedPath);
            return AccessResult.Allow();
        }

        return AccessResult.Deny($"Token does not have permission for {method} {path}");
    }

    private async Task<Permission?> FindMatchingPermissionAsync(string method, string normalizedPath, CancellationToken ct)
    {
        var allPermissions = await _permissionRepo.GetAllActiveForGatekeeperAsync(method, ct);
        return allPermissions.FirstOrDefault(p => RoutePatternMatches(p.Endpoint!, normalizedPath));
    }

    private static string NormalizePath(string path)
        => path.StartsWith('/') ? path : "/" + path;

    private ClaimsPrincipal ValidateJwt(string token, out Exception? validationException)
    {
        validationException = null;

        var jwtSecret = _configuration["Jwt:Secret"] ?? Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? throw new InvalidOperationException("JWT_SECRET not configured");
        var jwtIssuer = _configuration["Jwt:Issuer"] ?? Environment.GetEnvironmentVariable("JWT_ISSUER")
            ?? "swovnai";
        var jwtAudience = _configuration["Jwt:Audience"] ?? Environment.GetEnvironmentVariable("JWT_AUDIENCE")
            ?? "swovnai";

        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var key = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtSecret));

        try
        {
            var principal = handler.ValidateToken(token, new Microsoft.IdentityModel.Tokens.TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,
                ValidateAudience = true,
                ValidAudience = jwtAudience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero,
                RoleClaimType = ClaimTypes.Role
            }, out _);

            return principal;
        }
        catch (Exception ex)
        {
            validationException = ex;
            return new ClaimsPrincipal();
        }
    }

    private static bool RoutePatternMatches(string pattern, string path)
    {
        var patSegs  = pattern.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var pathSegs = path.Split('/',    StringSplitOptions.RemoveEmptyEntries);

        if (patSegs.Length != pathSegs.Length) return false;

        for (var i = 0; i < patSegs.Length; i++)
        {
            if (patSegs[i].StartsWith('{') && patSegs[i].EndsWith('}')) continue;

            if (!patSegs[i].Equals(pathSegs[i], StringComparison.OrdinalIgnoreCase))
                return false;
        }

        return true;
    }

    private static string? ExtractResource(string path)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);

        foreach (var seg in segments)
        {
            if (seg.Equals("api", StringComparison.OrdinalIgnoreCase) ||
                seg.StartsWith('{') || seg.StartsWith(':'))
                continue;

            return seg.ToLowerInvariant().Replace("-", "_");
        }

        return null;
    }

    private static string? DeriveAction(string method, string path)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var hasParams = segments.Any(s => s.StartsWith('{'));

        var action = method.ToUpperInvariant() switch
        {
            "GET"    => hasParams ? "read" : "list",
            "POST"   => "create",
            "PUT"    => "update",
            "PATCH"  => "patch",
            "DELETE" => "delete",
            _        => null
        };

        if (action == null) return null;

        // Check for trailing non-param segments (e.g. "stock" in /api/products/{id}/stock)
        var resourceIdx = Array.FindIndex(segments, s => !s.StartsWith('{'));
        var trailingSlugs = segments
            .Skip(resourceIdx + 1)
            .Where(s => !s.StartsWith('{'))
            .Select(s => s.ToLowerInvariant().Replace("-", "_"))
            .ToList();

        return trailingSlugs.Count > 0
            ? $"{action}_{string.Join("_", trailingSlugs)}"
            : action;
    }
}

internal record AccessResult(bool Allowed, string? Reason = null, int StatusCode = 403)
{
    public static AccessResult Allow() => new(true);
    public static AccessResult Deny(string reason, int statusCode = 403) => new(false, reason, statusCode);
}
