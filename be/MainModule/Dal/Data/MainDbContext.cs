using MainModule.Dal.Entities;
using Microsoft.EntityFrameworkCore;

namespace MainModule.Data;

public class MainDbContext : DbContext
{
    public MainDbContext(DbContextOptions<MainDbContext> options) : base(options)
    {
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Permission> Permissions => Set<Permission>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Owned by AuthModule — MainModule can query/insert but never alters the schema
        modelBuilder.Entity<Permission>()
            .ToTable("permissions", t => t.ExcludeFromMigrations());

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasIndex(p => p.SKU).IsUnique();
            entity.Property(p => p.IsActive).HasDefaultValue(true);
            entity.Property(p => p.StockQuantity).HasDefaultValue(0);
            entity.Property(p => p.CreatedAt).HasDefaultValueSql("NOW()");
        });
    }
}
