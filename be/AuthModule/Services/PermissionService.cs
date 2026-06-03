using AuthModule.Data;
using AuthModule.DTOs;
using AuthModule.Mappers;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Services;

public class PermissionService : IPermissionService
{
    private readonly AuthDbContext _db;

    public PermissionService(AuthDbContext db)
    {
        _db = db;
    }

    public async Task<PermissionDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.Permissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        return entity == null ? null : PermissionMapper.ToDto(entity);
    }

    public async Task<PagedResult<PermissionDto>> GetAllAsync(
        int page, int pageSize, string? search, CancellationToken ct = default)
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

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => PermissionMapper.ToDto(p))
            .ToListAsync(ct);

        return new PagedResult<PermissionDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PermissionDto> UpdateAsync(
        Guid id, UpdatePermissionDto dto, Guid? updatedBy, CancellationToken ct = default)
    {
        var entity = await _db.Permissions.FindAsync(new object[] { id }, ct)
            ?? throw new KeyNotFoundException($"Permission {id} not found.");

        if (entity.IsSystem)
            throw new InvalidOperationException("Cannot modify system permission.");

        if (dto.PermissionName != null)
            entity.PermissionName = dto.PermissionName;
        if (dto.PermissionCode != null)
            entity.PermissionCode = dto.PermissionCode;
        if (dto.Description != null)
            entity.Description = dto.Description;
        if (dto.IsPublic.HasValue)
            entity.IsPublic = dto.IsPublic.Value;
        if (dto.IsActive.HasValue)
            entity.IsActive = dto.IsActive.Value;

        entity.UpdatedBy = updatedBy;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return PermissionMapper.ToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.Permissions.FindAsync(new object[] { id }, ct);
        if (entity == null) return false;
        if (entity.IsSystem)
            throw new InvalidOperationException("Cannot delete system permission.");

        _db.Permissions.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<List<PermissionDto>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default)
    {
        var idList = ids.ToList();
        return await _db.Permissions
            .AsNoTracking()
            .Where(p => idList.Contains(p.Id))
            .Select(p => PermissionMapper.ToDto(p))
            .ToListAsync(ct);
    }
}
