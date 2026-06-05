using AuthModule.Data;
using AuthModule.Dal.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Dal.Repositories;

public interface ITokenPermissionRepository : IRepository
{
    Task<List<TokenPermission>> GetByTokenIdAsync(Guid tokenId, CancellationToken ct = default);
    Task<bool> HasPermissionAsync(Guid tokenId, Guid permissionId, CancellationToken ct = default);
    Task<TokenPermission> AddAsync(TokenPermission entity, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<TokenPermission> entities, CancellationToken ct = default);
    Task RemoveAsync(TokenPermission entity, CancellationToken ct = default);
    Task RemoveByTokenIdAsync(Guid tokenId, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}

public class TokenPermissionRepository : ITokenPermissionRepository
{
    private readonly AuthDbContext _db;

    public TokenPermissionRepository(AuthDbContext db)
    {
        _db = db;
    }

    public DbContext DbContext => _db;

    public async Task<List<TokenPermission>> GetByTokenIdAsync(Guid tokenId, CancellationToken ct = default)
    {
        return await _db.TokenPermissions
            .AsNoTracking()
            .Where(tp => tp.TokenId == tokenId)
            .Include(tp => tp.Permission)
            .ToListAsync(ct);
    }

    public async Task<bool> HasPermissionAsync(Guid tokenId, Guid permissionId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        return await _db.TokenPermissions
            .AsNoTracking()
            .AnyAsync(tp =>
                tp.TokenId == tokenId &&
                tp.PermissionId == permissionId &&
                (tp.ExpiresAt == null || tp.ExpiresAt > now),
                ct);
    }

    public async Task<TokenPermission> AddAsync(TokenPermission entity, CancellationToken ct = default)
    {
        await _db.TokenPermissions.AddAsync(entity, ct);
        return entity;
    }

    public async Task AddRangeAsync(IEnumerable<TokenPermission> entities, CancellationToken ct = default)
    {
        await _db.TokenPermissions.AddRangeAsync(entities, ct);
    }

    public async Task RemoveAsync(TokenPermission entity, CancellationToken ct = default)
    {
        _db.TokenPermissions.Remove(entity);
        await Task.CompletedTask;
    }

    public async Task RemoveByTokenIdAsync(Guid tokenId, CancellationToken ct = default)
    {
        await _db.TokenPermissions
            .Where(tp => tp.TokenId == tokenId)
            .ExecuteDeleteAsync(ct);
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _db.SaveChangesAsync(ct);
    }
}
