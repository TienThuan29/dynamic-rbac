using System.Text;
using System.Text.Json;

namespace LocalGateway.Middleware;

/// <summary>
/// Thrown by GatewayAuthMiddleware when the gatekeeper denies a request.
/// Caught at the top of the pipeline to prevent YARP from committing a 200 first.
/// </summary>
public class GatekeeperDenyException : Exception
{
    public int StatusCode { get; }
    public GatekeeperDenyException(int statusCode, string reason)
        : base(reason)
    {
        StatusCode = statusCode;
    }
}

/// <summary>
/// Middleware that intercepts requests and delegates authentication + authorization
/// to the AuthModule gatekeeper endpoint before forwarding to downstream services.
///
/// Flow:
///   1. Extract Authorization header from the incoming request.
///   2. POST to AuthModule /api/gatekeeper with method, path, and token.
///   3. AuthModule validates the JWT and checks user permissions.
///   4. On Allow: inject X-UserId, X-AccountId, X-Email, X-Role headers into
///      the request so downstream services can read them without re-validating.
///      Then let the request continue to the reverse proxy forwarder.
///   5. On Deny: throw GatekeeperDenyException — caught at the top of the
///      pipeline so YARP never commits a 200 response first.
/// </summary>
public class GatewayAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly HttpClient _httpClient;
    private readonly ILogger<GatewayAuthMiddleware> _logger;

    public GatewayAuthMiddleware(
        RequestDelegate next,
        IHttpClientFactory httpClientFactory,
        ILogger<GatewayAuthMiddleware> logger)
    {
        _next = next;
        _httpClient = httpClientFactory.CreateClient("AuthModule");
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "/";

        // Gatekeeper itself and auth endpoints (login) are passthrough
        if (path.StartsWith("/api/gatekeeper", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/auth/", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/login", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // Only protect routes that go through the reverse proxy
        if (!path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var authHeader = context.Request.Headers.Authorization.FirstOrDefault() ?? "";
        var method = context.Request.Method;
        var query = context.Request.QueryString.HasValue
            ? context.Request.QueryString.Value?.TrimStart('?')
            : null;

        _logger.LogDebug(
            "GatewayAuth: checking {Method} {Path} token={HasToken}",
            method, path, !string.IsNullOrEmpty(authHeader));

        GatekeeperResponse response;
        try
        {
            response = await CallGatekeeperAsync(authHeader, method, path, query);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "GatewayAuth: failed to reach gatekeeper for {Method} {Path}",
                method, path);
            context.Response.StatusCode = 503;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(
                """{"error":"Authentication service unavailable","message":"Unable to reach AuthModule"}""");
            return;
        }

        if (!response.Allowed)
        {
            _logger.LogWarning(
                "GatewayAuth: denied {Method} {Path} — {Reason}",
                method, path, response.Reason);
            // Throw so the top-level exception handler can set the response.
            // Writing directly here causes YARP to commit a 200 before we can set the status.
            throw new GatekeeperDenyException(response.StatusCode, response.Reason ?? "Access denied");
        }

        // Inject identity headers so downstream services can use them directly
        context.Request.Headers["X-UserId"] = response.UserId?.ToString() ?? "";
        context.Request.Headers["X-AccountId"] = response.AccountId?.ToString() ?? "";
        context.Request.Headers["X-Email"] = response.Email ?? "";
        context.Request.Headers["X-Role"] = response.Role ?? "";

        _logger.LogDebug(
            "GatewayAuth: allowed userId={UserId} accountId={AccountId} for {Method} {Path}",
            response.UserId, response.AccountId, method, path);

        await _next(context);
    }

    private async Task<GatekeeperResponse> CallGatekeeperAsync(
        string authHeader,
        string method,
        string path,
        string? query)
    {
        var request = new GatekeeperRequest
        {
            AuthorizationHeader = authHeader,
            Method = method,
            Path = path,
            Query = query
        };

        var json = JsonSerializer.Serialize(request, _serializerOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        var httpResponse = await _httpClient.PostAsync("/api/gatekeeper", content);
        var responseBody = await httpResponse.Content.ReadAsStringAsync();

        _logger.LogDebug("Gatekeeper response: {Status} — {Body}",
            httpResponse.StatusCode, responseBody);

        // Even on HTTP errors from gatekeeper, attempt to parse
        if (!httpResponse.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Gatekeeper returned non-success status {Status} for {Method} {Path}",
                httpResponse.StatusCode, method, path);
        }

        try
        {
            return JsonSerializer.Deserialize<GatekeeperResponse>(responseBody, _serializerOptions)
                ?? GatekeeperResponse.Deny("Empty gatekeeper response", 503);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse gatekeeper response: {Body}", responseBody);
            return GatekeeperResponse.Deny("Invalid gatekeeper response", 503);
        }
    }

    private static readonly JsonSerializerOptions _serializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };
}

// ── Internal DTOs (mirrors AuthModule DTOs) ──────────────────────────────────

internal class GatekeeperRequest
{
    public string AuthorizationHeader { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string? Query { get; set; }
}

internal class GatekeeperResponse
{
    public bool Allowed { get; set; }
    public string? Reason { get; set; }
    public int StatusCode { get; set; }
    public Guid? UserId { get; set; }
    public Guid? AccountId { get; set; }
    public string? Email { get; set; }
    public string? Role { get; set; }

    public static GatekeeperResponse Deny(string reason, int statusCode = 403) =>
        new() { Allowed = false, Reason = reason, StatusCode = statusCode };
}

/// <summary>
/// Extension methods to register this middleware in the pipeline.
/// </summary>
public static class GatewayAuthMiddlewareExtensions
{
    public static IApplicationBuilder UseGatewayAuth(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<GatewayAuthMiddleware>();
    }
}
