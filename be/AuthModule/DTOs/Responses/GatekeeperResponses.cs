namespace AuthModule.DTOs.Responses;

/// <summary>
/// Request sent from Gateway to AuthModule gatekeeper to validate a JWT
/// and check whether the user has permission for the requested resource.
/// </summary>
public class GatekeeperRequest
{
    /// <summary>
    /// The Authorization header value (e.g. "Bearer eyJ...").
    /// </summary>
    public string AuthorizationHeader { get; set; } = string.Empty;

    /// <summary>
    /// The original HTTP method of the incoming request.
    /// </summary>
    public string Method { get; set; } = string.Empty;

    /// <summary>
    /// The original request path (e.g. "/api/products").
    /// </summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>
    /// Raw query string (without the leading "?"), or null/empty if none.
    /// </summary>
    public string? Query { get; set; }
}

/// <summary>
/// Response from AuthModule gatekeeper back to the Gateway.
/// </summary>
public class GatekeeperResponse
{
    /// <summary>
    /// True when the token is valid and the user has permission.
    /// </summary>
    public bool Allowed { get; set; }

    /// <summary>
    /// Human-readable reason when denied (null when Allowed is true).
    /// </summary>
    public string? Reason { get; set; }

    /// <summary>
    /// HTTP status code that should be returned to the client.
    /// </summary>
    public int StatusCode { get; set; }

    /// <summary>
    /// The validated user ID (from JWT "userId" claim). Null if token invalid.
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// The account ID (from JWT "accountId" claim). Null if token invalid.
    /// </summary>
    public Guid? AccountId { get; set; }

    /// <summary>
    /// The user's email (from JWT "email" claim). Null if token invalid.
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// The user's role (from JWT role claim). Null if token invalid.
    /// </summary>
    public string? Role { get; set; }

    public static GatekeeperResponse Allow(Guid userId, Guid accountId, string email, string role) =>
        new()
        {
            Allowed = true,
            StatusCode = 200,
            UserId = userId,
            AccountId = accountId,
            Email = email,
            Role = role
        };

    public static GatekeeperResponse Deny(string reason, int statusCode = 403) =>
        new()
        {
            Allowed = false,
            Reason = reason,
            StatusCode = statusCode
        };
}
