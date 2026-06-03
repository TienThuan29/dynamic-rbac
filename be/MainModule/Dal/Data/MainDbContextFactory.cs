using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MainModule.Data;

public class MainDbContextFactory : IDesignTimeDbContextFactory<MainDbContext>
{
    public MainDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection not configured");

        var optionsBuilder = new DbContextOptionsBuilder<MainDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new MainDbContext(optionsBuilder.Options);
    }
}
