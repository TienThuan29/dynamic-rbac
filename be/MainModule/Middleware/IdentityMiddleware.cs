using System.Security.Claims;

namespace MainModule.Middleware;

/// <summary>
/// Reads identity from headers injected by the gateway layer.
/// Supports both LocalGateway (X-*) and Azure API Management (X-APIM-*).
/// Stores resolved identity in HttpContext.Items so downstream services can read it.
/// </summary>
public class IdentityMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<IdentityMiddleware> _logger;

    public IdentityMiddleware(RequestDelegate next, ILogger<IdentityMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var userId = TryGetHeader(context, "X-UserId", "X-APIM-UserId")
                  ?? context.User.FindFirst("userId")?.Value
                  ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var accountId = TryGetHeader(context, "X-AccountId", "X-APIM-AccountId")
                     ?? context.User.FindFirst("accountId")?.Value;

        var email = TryGetHeader(context, "X-Email", "X-APIM-Email")
                 ?? context.User.FindFirst("email")?.Value
                 ?? context.User.FindFirst(ClaimTypes.Email)?.Value;

        var role = TryGetHeader(context, "X-Role", "X-APIM-Role")
                ?? context.User.FindFirst(ClaimTypes.Role)?.Value
                ?? context.User.FindFirst("role")?.Value;

        if (!string.IsNullOrEmpty(userId) && Guid.TryParse(userId, out var parsedUserId))
        {
            context.Items["UserId"] = parsedUserId;
        }

        if (!string.IsNullOrEmpty(accountId) && Guid.TryParse(accountId, out var parsedAccountId))
        {
            context.Items["AccountId"] = parsedAccountId;
        }

        context.Items["Email"] = email ?? string.Empty;
        context.Items["Role"] = role ?? "User";

        if (userId != null)
        {
            _logger.LogDebug(
                "Identity: userId={UserId}, accountId={AccountId}, role={Role}",
                context.Items["UserId"], context.Items["AccountId"], context.Items["Role"]);
        }

        await _next(context);
    }

    private static string? TryGetHeader(HttpContext context, params string[] names)
    {
        foreach (var name in names)
        {
            if (context.Request.Headers.TryGetValue(name, out var value)
                && !string.IsNullOrWhiteSpace(value.FirstOrDefault()))
            {
                return value.FirstOrDefault();
            }
        }
        return null;
    }
}
