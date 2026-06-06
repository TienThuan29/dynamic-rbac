using MainModule.Data;
using MainModule.Extensions;
using MainModule.Middleware;
using MainModule.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<MainDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<IProductService, ProductService>();

var app = builder.Build();

// Read identity from headers injected by LocalGateway (dev) or APIM (production).
// Falls back to X-APIM-* headers from Azure API Management.
app.UseMiddleware<IdentityMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();

await app.SyncEndpointPermissionsAsync();

app.Run();
