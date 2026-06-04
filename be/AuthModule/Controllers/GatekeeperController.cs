using AuthModule.Attributes;
using AuthModule.Data;
using AuthModule.DTOs;
using AuthModule.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Claims;

namespace AuthModule.Controllers;

/// <summary>
/// Gatekeeper endpoint used exclusively by the API Gateway to validate JWTs
/// and check user permissions before the Gateway forwards requests to downstream
/// services (e.g. MainModule).
/// </summary>
[ApiController]
[Route("api/gatekeeper")]
[AllowAnonymous]
[PermissionMeta(Public = PublicMode.Public, IsSystem = true)]
public class GatekeeperController : ControllerBase
{
    private readonly AuthDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GatekeeperController> _logger;

    public GatekeeperController(
        AuthDbContext dbContext,
        IConfiguration configuration,
        ILogger<GatekeeperController> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<GatekeeperResponseDto>> CheckAccess(
        [FromBody] GatekeeperRequestDto request,
        CancellationToken ct = default)
    {
        var authHeader = request.AuthorizationHeader;

        // ── 1. Extract and validate the Bearer token ──────────────────────────
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Gatekeeper: missing or invalid Authorization header");
            return Ok(GatekeeperResponseDto.Deny("Missing or invalid Authorization header", 401));
        }

        var token = authHeader["Bearer ".Length..].Trim();
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogWarning("Gatekeeper: empty token");
            return Ok(GatekeeperResponseDto.Deny("Token is empty", 401));
        }

        // ── 2. Decode and validate the JWT (no signature verification here —
        //     AuthModule's JwtBearer middleware is not in this pipeline, so we
        //     decode manually and check the signature against the same secret) ─
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
                return Ok(GatekeeperResponseDto.Deny("Invalid or expired token", 401));
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
                return Ok(GatekeeperResponseDto.Deny("Token missing valid userId claim", 401));
            }

            if (string.IsNullOrEmpty(accountIdClaim) || !Guid.TryParse(accountIdClaim, out accountId))
            {
                _logger.LogWarning("Gatekeeper: missing or invalid accountId claim");
                return Ok(GatekeeperResponseDto.Deny("Token missing valid accountId claim", 401));
            }

            email = emailClaim ?? string.Empty;
            role = roleClaim ?? "User";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gatekeeper: unexpected error during token validation");
            return Ok(GatekeeperResponseDto.Deny("Token validation error", 401));
        }

        // ── 3. Normalize request path ────────────────────────────────────────
        var normalizedPath = request.Path.StartsWith('/')
            ? request.Path
            : "/" + request.Path;

        // ── 4. Admin role bypass — Admins can access any endpoint ───────────
        if (role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogDebug(
                "Gatekeeper: Admin role bypass for {Method} {Path}",
                request.Method, normalizedPath);
            return Ok(GatekeeperResponseDto.Allow(userId, accountId, email, role));
        }

        // ── 5. Check if the endpoint is public ────────────────────────────────
        var permission = await _dbContext.Permissions
            .AsNoTracking()
            .FirstOrDefaultAsync(
                p => p.IsActive &&
                     EF.Functions.ILike(p.Endpoint ?? "", normalizedPath) &&
                     EF.Functions.ILike(p.Method ?? "", request.Method),
                ct);

        if (permission == null)
        {
            _logger.LogWarning(
                "Gatekeeper: no permission record found for {Method} {Path}",
                request.Method, normalizedPath);
            return Ok(GatekeeperResponseDto.Deny(
                $"No permission record for {request.Method} {request.Path}", 403));
        }

        // Public endpoints are always allowed
        if (permission.IsPublic)
        {
            _logger.LogDebug(
                "Gatekeeper: {Method} {Path} is public — allowed",
                request.Method, normalizedPath);
            return Ok(GatekeeperResponseDto.Allow(userId, accountId, email, role));
        }

        // ── 6. Check user permission in UserPermissions table ─────────────────
        //    Supports two grant modes:
        //    a) Exact match — user has this specific PermissionId
        //    b) Wildcard match — user has [resource]:admin which covers every action on that resource
        var now = DateTime.UtcNow;

        // First, check for exact permission match
        var hasExactPermission = await _dbContext.UserPermissions
            .AsNoTracking()
            .AnyAsync(
                up => up.AccountId == accountId &&
                      up.PermissionId == permission.Id &&
                      (up.ExpiresAt == null || up.ExpiresAt > now),
                ct);

        if (hasExactPermission)
        {
            _logger.LogDebug(
                "Gatekeeper: account {AccountId} allowed (exact) for {Method} {Path}",
                accountId, request.Method, normalizedPath);
            return Ok(GatekeeperResponseDto.Allow(userId, accountId, email, role));
        }

        // Fallback: check [resource]:admin wildcard
        var resource = ExtractResource(normalizedPath);
        if (resource is not null)
        {
            var adminCode = $"{resource}:admin";
            // Join to Permission so we can read PermissionCode without needing Include
            var hasAdminPermission = await _dbContext.UserPermissions
                .AsNoTracking()
                .AnyAsync(
                    up => up.AccountId == accountId &&
                          up.Permission.PermissionCode == adminCode &&
                          (up.ExpiresAt == null || up.ExpiresAt > now),
                    ct);

            if (hasAdminPermission)
            {
                _logger.LogDebug(
                    "Gatekeeper: account {AccountId} allowed (admin wildcard {AdminCode}) for {Method} {Path}",
                    accountId, adminCode, request.Method, normalizedPath);
                return Ok(GatekeeperResponseDto.Allow(userId, accountId, email, role));
            }
        }

        _logger.LogWarning(
            "Gatekeeper: account {AccountId} denied for {Method} {Path}",
            accountId, request.Method, normalizedPath);
        return Ok(GatekeeperResponseDto.Deny(
            $"Access denied: no permission for {request.Method} {request.Path}", 403));
    }

    private ClaimsPrincipal ValidateJwt(string token, out Exception? validationException)
    {
        validationException = null;

        var jwtSecret = _configuration["Jwt:Secret"]
            ?? Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? throw new InvalidOperationException("JWT_SECRET not configured");
        var jwtIssuer = _configuration["Jwt:Issuer"]
            ?? Environment.GetEnvironmentVariable("JWT_ISSUER")
            ?? "swovnai";
        var jwtAudience = _configuration["Jwt:Audience"]
            ?? Environment.GetEnvironmentVariable("JWT_AUDIENCE")
            ?? "swovnai";

        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var key = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
            System.Text.Encoding.UTF8.GetBytes(jwtSecret));

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

    /// <summary>
    /// Extracts the top-level resource name from a route path.
    /// /api/products/{id}/stock  →  "products"
    /// /api/users/{id}           →  "users"
    /// </summary>
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
