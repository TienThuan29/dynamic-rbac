using AuthModule.Data;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Dal.Repositories;

public interface IRepository
{
    DbContext DbContext { get; }
}

public interface IPermissionRepository : IRepository
{
    Task<Entities.Permission?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Entities.Permission?> GetByIdWithTrackingAsync(Guid id, CancellationToken ct = default);
    Task<List<Entities.Permission>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default);
    Task<(List<Entities.Permission> Items, int TotalCount)> GetAllAsync(
        int page, int pageSize, string? search,
        string? method, bool? isSystem, bool? isActive,
        string? resource, CancellationToken ct = default);
    Task<List<string>> GetDistinctResourcesAsync(CancellationToken ct = default);
    Task<List<Entities.Permission>> GetAllActiveForGatekeeperAsync(string? httpMethod, CancellationToken ct = default);
    Task AddAsync(Entities.Permission permission, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<Entities.Permission> permissions, CancellationToken ct = default);
    Task RemoveAsync(Entities.Permission permission, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}

public class PermissionRepository : IPermissionRepository
{
    private readonly AuthDbContext _db;

    public PermissionRepository(AuthDbContext db)
    {
        _db = db;
    }

    public DbContext DbContext => _db;

    public async Task<Entities.Permission?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Permissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    public async Task<Entities.Permission?> GetByIdWithTrackingAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Permissions.FindAsync(new object[] { id }, ct);
    }

    public async Task<List<Entities.Permission>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default)
    {
        var idList = ids.ToList();
        return await _db.Permissions
            .AsNoTracking()
            .Where(p => idList.Contains(p.Id))
            .ToListAsync(ct);
    }

    public async Task<(List<Entities.Permission> Items, int TotalCount)> GetAllAsync(
        int page, int pageSize, string? search,
        string? method, bool? isSystem, bool? isActive,
        string? resource, CancellationToken ct = default)
    {
        var query = _db.Permissions.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p =>
                (p.PermissionName != null && p.PermissionName.ToLower().Contains(s)) ||
                (p.PermissionCode != null && p.PermissionCode.ToLower().Contains(s)) ||
                (p.Endpoint != null && p.Endpoint.ToLower().Contains(s)) ||
                (p.Description != null && p.Description.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(method))
        {
            query = query.Where(p => p.Method != null && p.Method.ToUpper() == method.ToUpper());
        }

        if (isSystem.HasValue)
        {
            query = query.Where(p => p.IsSystem == isSystem.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(p => p.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(resource))
        {
            var prefix = resource.ToLower();
            query = query.Where(p =>
                p.PermissionCode != null &&
                p.PermissionCode.ToLower().StartsWith(prefix));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<List<string>> GetDistinctResourcesAsync(CancellationToken ct = default)
    {
        var codes = await _db.Permissions
            .AsNoTracking()
            .Where(p => p.PermissionCode != null)
            .Select(p => p.PermissionCode!)
            .ToListAsync(ct);

        return codes
            .Select(code => code.Split(':')[0])
            .Distinct()
            .OrderBy(r => r)
            .ToList();
    }

    public async Task<List<Entities.Permission>> GetAllActiveForGatekeeperAsync(
        string? httpMethod, CancellationToken ct = default)
    {
        var query = _db.Permissions
            .AsNoTracking()
            .Where(p => p.IsActive && p.Endpoint != null);

        if (!string.IsNullOrWhiteSpace(httpMethod))
        {
            query = query.Where(p => p.Method != null && p.Method.ToUpper() == httpMethod.ToUpper());
        }

        return await query.ToListAsync(ct);
    }

    public async Task AddAsync(Entities.Permission permission, CancellationToken ct = default)
    {
        await _db.Permissions.AddAsync(permission, ct);
    }

    public async Task AddRangeAsync(IEnumerable<Entities.Permission> permissions, CancellationToken ct = default)
    {
        await _db.Permissions.AddRangeAsync(permissions, ct);
    }

    public async Task RemoveAsync(Entities.Permission permission, CancellationToken ct = default)
    {
        _db.Permissions.Remove(permission);
        await Task.CompletedTask;
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _db.SaveChangesAsync(ct);
    }
}
