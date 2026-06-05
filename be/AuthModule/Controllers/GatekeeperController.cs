using System.Security.Claims;
using AuthModule.Attributes;
using AuthModule.Dal.Repositories;
using AuthModule.DTOs.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthModule.Controllers;

/// <summary>
/// Gatekeeper endpoint used exclusively by the API Gateway to validate JWTs
/// and check user permissions before the Gateway forwards requests to downstream
/// services (e.g. MainModule).
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
    private readonly IConfiguration _configuration;
    private readonly ILogger<GatekeeperController> _logger;

    public GatekeeperController(
        IUserPermissionRepository userPermRepo,
        IPermissionRepository permissionRepo,
        IConfiguration configuration,
        ILogger<GatekeeperController> logger)
    {
        _userPermRepo = userPermRepo;
        _permissionRepo = permissionRepo;
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

        var token = authHeader["Bearer ".Length..].Trim();
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogWarning("Gatekeeper: empty token");
            return Ok(GatekeeperResponse.Deny("Token is empty", 401));
        }

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

            var userIdClaim = principal.FindFirst("userId")?.Value
                ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var accountIdClaim = principal.FindFirst("accountId")?.Value;
            var emailClaim = principal.FindFirst("email")?.Value
                ?? principal.FindFirst(ClaimTypes.Email)?.Value;
            var roleClaim = principal.FindFirst(ClaimTypes.Role)?.Value
                ?? principal.FindFirst("role")?.Value;

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

        var result = await AuthorizeRequestAsync(accountId, role, request.Method, request.Path, ct);

        if (result.Allowed)
            return Ok(GatekeeperResponse.Allow(userId, accountId, email, role));

        return Ok(GatekeeperResponse.Deny(result.Reason ?? "Access denied", result.StatusCode));
    }

    private async Task<AccessResult> AuthorizeRequestAsync(
        Guid accountId,
        string role,
        string method,
        string path,
        CancellationToken ct)
    {
        var normalizedPath = path.StartsWith('/') ? path : "/" + path;

        if (role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            return AccessResult.Allow();

        var allPermissions = await _permissionRepo.GetAllActiveForGatekeeperAsync(method, ct);
        var permission = allPermissions
            .Where(p => RoutePatternMatches(p.Endpoint!, normalizedPath))
            .FirstOrDefault();

        if (permission == null)
        {
            _logger.LogWarning(
                "Gatekeeper: no permission record found for {Method} {Path}",
                method, normalizedPath);
            return AccessResult.Deny($"No permission record for {method} {path}");
        }

        if (permission.IsPublic)
            return AccessResult.Allow();

        var now = DateTime.UtcNow;

        var hasExactPermission = await _userPermRepo.AnyAsync(accountId, permission.Id, now, ct);

        if (hasExactPermission)
            return AccessResult.Allow();

        var resource = ExtractResource(normalizedPath);
        if (resource is not null)
        {
            var adminCode = $"{resource}:admin";
            var hasAdminPermission = await _userPermRepo.AnyByResourceCodeAsync(accountId, adminCode, now, ct);

            if (hasAdminPermission)
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
}

internal record AccessResult(bool Allowed, string? Reason = null, int StatusCode = 403)
{
    public static AccessResult Allow() => new(true);
    public static AccessResult Deny(string reason, int statusCode = 403) => new(false, reason, statusCode);
}
