using AuthModule.Data;
using AuthModule.Dal.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Dal.Repositories;

public interface IUserPermissionRepository : IRepository
{
    Task<List<UserPermission>> GetByAccountIdAsync(Guid accountId, CancellationToken ct = default);
    Task<List<UserPermission>> GetByAccountIdWithPermissionAsync(Guid accountId, CancellationToken ct = default);
    Task<List<Guid>> GetExistingIdsAsync(Guid accountId, IEnumerable<Guid> permissionIds, CancellationToken ct = default);
    Task<bool> AnyAsync(Guid accountId, Guid permissionId, DateTime now, CancellationToken ct = default);
    Task<bool> AnyByResourceCodeAsync(Guid accountId, string resourceCode, DateTime now, CancellationToken ct = default);
    Task<int> CountByAccountAndPermissionsAsync(Guid accountId, IEnumerable<Guid> permissionIds, CancellationToken ct = default);
    Task AddAsync(UserPermission entity, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<UserPermission> entities, CancellationToken ct = default);
    Task RemoveAsync(UserPermission entity, CancellationToken ct = default);
    Task RemoveRangeAsync(IEnumerable<UserPermission> entities, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}

public class UserPermissionRepository : IUserPermissionRepository
{
    private readonly AuthDbContext _db;

    public UserPermissionRepository(AuthDbContext db)
    {
        _db = db;
    }

    public DbContext DbContext => _db;

    public async Task<List<UserPermission>> GetByAccountIdAsync(Guid accountId, CancellationToken ct = default)
    {
        return await _db.UserPermissions
            .AsNoTracking()
            .Where(up => up.AccountId == accountId)
            .ToListAsync(ct);
    }

    public async Task<List<UserPermission>> GetByAccountIdWithPermissionAsync(Guid accountId, CancellationToken ct = default)
    {
        return await _db.UserPermissions
            .AsNoTracking()
            .Where(up => up.AccountId == accountId)
            .Include(up => up.Permission)
            .ToListAsync(ct);
    }

    public async Task<List<Guid>> GetExistingIdsAsync(Guid accountId, IEnumerable<Guid> permissionIds, CancellationToken ct = default)
    {
        return await _db.UserPermissions
            .Where(up => up.AccountId == accountId && permissionIds.Contains(up.PermissionId))
            .Select(up => up.PermissionId)
            .ToListAsync(ct);
    }

    public async Task<bool> AnyAsync(Guid accountId, Guid permissionId, DateTime now, CancellationToken ct = default)
    {
        return await _db.UserPermissions
            .AsNoTracking()
            .AnyAsync(up =>
                up.AccountId == accountId &&
                up.PermissionId == permissionId &&
                (up.ExpiresAt == null || up.ExpiresAt > now),
                ct);
    }

    public async Task<bool> AnyByResourceCodeAsync(Guid accountId, string resourceCode, DateTime now, CancellationToken ct = default)
    {
        return await _db.UserPermissions
            .AsNoTracking()
            .AnyAsync(up =>
                up.AccountId == accountId &&
                up.Permission != null &&
                up.Permission.PermissionCode == resourceCode &&
                (up.ExpiresAt == null || up.ExpiresAt > now),
                ct);
    }

    public async Task<int> CountByAccountAndPermissionsAsync(
        Guid accountId, IEnumerable<Guid> permissionIds, CancellationToken ct = default)
    {
        return await _db.UserPermissions
            .CountAsync(up =>
                up.AccountId == accountId &&
                permissionIds.Contains(up.PermissionId),
                ct);
    }

    public async Task AddAsync(UserPermission entity, CancellationToken ct = default)
    {
        await _db.UserPermissions.AddAsync(entity, ct);
    }

    public async Task AddRangeAsync(IEnumerable<UserPermission> entities, CancellationToken ct = default)
    {
        await _db.UserPermissions.AddRangeAsync(entities, ct);
    }

    public async Task RemoveAsync(UserPermission entity, CancellationToken ct = default)
    {
        _db.UserPermissions.Remove(entity);
        await Task.CompletedTask;
    }

    public async Task RemoveRangeAsync(IEnumerable<UserPermission> entities, CancellationToken ct = default)
    {
        _db.UserPermissions.RemoveRange(entities);
        await Task.CompletedTask;
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _db.SaveChangesAsync(ct);
    }
}
