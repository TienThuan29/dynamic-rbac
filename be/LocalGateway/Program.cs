using LocalGateway.Middleware;
using Yarp.ReverseProxy.Configuration;

var builder = WebApplication.CreateBuilder(args);

// Named HttpClient for calling AuthModule gatekeeper
builder.Services.AddHttpClient("AuthModule", client =>
{
    client.BaseAddress = new Uri("http://localhost:5001");
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

// GatewayAuthMiddleware runs BEFORE the reverse proxy so it can
// validate auth and inject identity headers before forwarding.
app.UseGatewayAuth();

app.MapReverseProxy();

app.Run();
