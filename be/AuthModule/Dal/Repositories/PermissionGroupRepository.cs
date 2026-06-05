using AuthModule.Data;
using AuthModule.Dal.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Dal.Repositories;

public interface IPermissionGroupRepository : IRepository
{
    Task<PermissionGroup?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PermissionGroup?> GetByIdWithTrackingAsync(Guid id, CancellationToken ct = default);
    Task<(List<PermissionGroup> Items, int TotalCount)> GetAllAsync(
        int page, int pageSize, string? search, CancellationToken ct = default);
    Task AddAsync(PermissionGroup group, CancellationToken ct = default);
    Task RemoveAsync(PermissionGroup group, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}

public class PermissionGroupRepository : IPermissionGroupRepository
{
    private readonly AuthDbContext _db;

    public PermissionGroupRepository(AuthDbContext db)
    {
        _db = db;
    }

    public DbContext DbContext => _db;

    public async Task<PermissionGroup?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.PermissionGroups
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == id, ct);
    }

    public async Task<PermissionGroup?> GetByIdWithTrackingAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.PermissionGroups.FindAsync(new object[] { id }, ct);
    }

    public async Task<(List<PermissionGroup> Items, int TotalCount)> GetAllAsync(
        int page, int pageSize, string? search, CancellationToken ct = default)
    {
        var query = _db.PermissionGroups.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(g =>
                g.GroupName.ToLower().Contains(s) ||
                (g.Description != null && g.Description.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(g => g.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task AddAsync(PermissionGroup group, CancellationToken ct = default)
    {
        await _db.PermissionGroups.AddAsync(group, ct);
    }

    public async Task RemoveAsync(PermissionGroup group, CancellationToken ct = default)
    {
        _db.PermissionGroups.Remove(group);
        await Task.CompletedTask;
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _db.SaveChangesAsync(ct);
    }
}
