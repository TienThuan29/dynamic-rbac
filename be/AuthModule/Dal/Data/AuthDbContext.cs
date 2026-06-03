using AuthModule.Dal.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Data;

public class AuthDbContext : DbContext
{
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options)
    {
    }

    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<User> Users => Set<User>();
    public DbSet<PermissionGroup> PermissionGroups => Set<PermissionGroup>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Account -> User (1:1)
        modelBuilder.Entity<Account>()
            .HasOne(a => a.User)
            .WithOne(u => u.Account)
            .HasForeignKey<User>(u => u.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // UserPermission: composite PK (account_id, permission_id)
        modelBuilder.Entity<UserPermission>()
            .HasKey(up => new { up.AccountId, up.PermissionId });

        // Account -> UserPermissions (1:N)
        modelBuilder.Entity<Account>()
            .HasMany(a => a.UserPermissions)
            .WithOne(up => up.Account)
            .HasForeignKey(up => up.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        // Permission -> UserPermissions (1:N)
        modelBuilder.Entity<Permission>()
            .HasMany(p => p.UserPermissions)
            .WithOne(up => up.Permission)
            .HasForeignKey(up => up.PermissionId)
            .OnDelete(DeleteBehavior.Cascade);

        // PermissionGroup.permission_ids — PostgreSQL text[]
        modelBuilder.Entity<PermissionGroup>()
            .Property(pg => pg.PermissionIds)
            .HasColumnType("text[]");

        // Unique indexes on Permission
        modelBuilder.Entity<Permission>()
            .HasIndex(p => p.PermissionName).IsUnique()
            .HasFilter("permission_name IS NOT NULL");

        modelBuilder.Entity<Permission>()
            .HasIndex(p => p.PermissionCode).IsUnique()
            .HasFilter("permission_code IS NOT NULL");
    }
}
