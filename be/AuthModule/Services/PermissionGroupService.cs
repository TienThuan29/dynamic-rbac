using AuthModule.Data;
using AuthModule.Dal.Entities;
using AuthModule.DTOs;
using AuthModule.Mappers;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Services;

public class PermissionGroupService : IPermissionGroupService
{
    private readonly AuthDbContext _db;
    private readonly IPermissionService _permissionService;

    public PermissionGroupService(AuthDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    public async Task<PermissionGroupDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.PermissionGroups
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == id, ct);

        return entity == null ? null : await PermissionGroupMapper.ToDtoAsync(entity, _permissionService, ct);
    }

    public async Task<PagedResult<PermissionGroupDto>> GetAllAsync(
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

        var result = new List<PermissionGroupDto>();
        foreach (var item in items)
            result.Add(await PermissionGroupMapper.ToDtoAsync(item, _permissionService, ct));

        return new PagedResult<PermissionGroupDto>
        {
            Items = result,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PermissionGroupDto> CreateAsync(
        CreatePermissionGroupDto dto, Guid? createdBy, CancellationToken ct = default)
    {
        var entity = new PermissionGroup
        {
            Id = Guid.NewGuid(),
            GroupName = dto.GroupName.Trim(),
            PermissionIds = dto.PermissionIds,
            Description = dto.Description?.Trim(),
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        _db.PermissionGroups.Add(entity);
        await _db.SaveChangesAsync(ct);

        return await PermissionGroupMapper.ToDtoAsync(entity, _permissionService, ct);
    }

    public async Task<PermissionGroupDto> UpdateAsync(
        Guid id, UpdatePermissionGroupDto dto, Guid? updatedBy, CancellationToken ct = default)
    {
        var entity = await _db.PermissionGroups.FindAsync(new object[] { id }, ct)
            ?? throw new KeyNotFoundException($"PermissionGroup {id} not found.");

        if (dto.GroupName != null)
            entity.GroupName = dto.GroupName.Trim();
        if (dto.PermissionIds != null)
            entity.PermissionIds = dto.PermissionIds;
        if (dto.Description != null)
            entity.Description = dto.Description.Trim();

        entity.UpdatedBy = updatedBy;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await PermissionGroupMapper.ToDtoAsync(entity, _permissionService, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.PermissionGroups.FindAsync(new object[] { id }, ct);
        if (entity == null) return false;

        _db.PermissionGroups.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
