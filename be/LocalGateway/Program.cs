using LocalGateway.Middleware;
using Yarp.ReverseProxy.Configuration;

var builder = WebApplication.CreateBuilder(args);

// Gateway mode: "Local" (use GatewayAuthMiddleware) or "APIM" (skip, let APIM handle auth)
var gatewayMode = builder.Configuration["Gateway:Mode"]
    ?? Environment.GetEnvironmentVariable("GATEWAY_MODE")
    ?? "Local";

var authModuleUrl = builder.Configuration["Gateway:AuthModuleUrl"]
    ?? Environment.GetEnvironmentVariable("AUTH_MODULE_URL")
    ?? "http://localhost:5001";

// Named HttpClient for calling AuthModule gatekeeper
builder.Services.AddHttpClient("AuthModule", client =>
{
    client.BaseAddress = new Uri(authModuleUrl);
    client.Timeout = TimeSpan.FromSeconds(10);
});

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

// Top-level exception handler: must run OUTSIDE UseGatewayAuth so GatekeeperDenyException
// is caught here and written to the response BEFORE YARP gets a chance to commit 200.
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (GatekeeperDenyException ex)
    {
        context.Response.StatusCode = ex.StatusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(
            System.Text.Json.JsonSerializer.Serialize(new { error = ex.Message }));
    }
});

// Only enable LocalGateway auth when not using APIM
if (!gatewayMode.Equals("APIM", StringComparison.OrdinalIgnoreCase))
{
    app.UseGatewayAuth();
}

app.MapReverseProxy();

app.Run();
