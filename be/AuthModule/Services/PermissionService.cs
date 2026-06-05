using AuthModule.Dal.Repositories;
using AuthModule.DTOs.Common;
using AuthModule.DTOs.Requests;
using AuthModule.DTOs.Responses;
using AuthModule.Mappers;

namespace AuthModule.Services;

public interface IPermissionService
{
    Task<PermissionResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<PermissionResponse>> GetAllAsync(int page, int pageSize, string? search, string? method, bool? isSystem, bool? isActive, string? resource, CancellationToken ct = default);
    Task<List<string>> GetDistinctResourcesAsync(CancellationToken ct = default);
    Task<PermissionResponse> UpdateAsync(Guid id, UpdatePermissionRequest dto, Guid? updatedBy, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<List<PermissionResponse>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default);
}

public class PermissionService : IPermissionService
{
    private readonly IPermissionRepository _permissionRepo;

    public PermissionService(IPermissionRepository permissionRepo)
    {
        _permissionRepo = permissionRepo;
    }

    public async Task<PermissionResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _permissionRepo.GetByIdAsync(id, ct);
        return entity == null ? null : PermissionMapper.ToResponse(entity);
    }

    public async Task<PagedResult<PermissionResponse>> GetAllAsync(
        int page, int pageSize, string? search,
        string? method, bool? isSystem, bool? isActive,
        string? resource, CancellationToken ct = default)
    {
        var (items, totalCount) = await _permissionRepo.GetAllAsync(
            page, pageSize, search, method, isSystem, isActive, resource, ct);

        return new PagedResult<PermissionResponse>
        {
            Items = items.Select(PermissionMapper.ToResponse).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PermissionResponse> UpdateAsync(
        Guid id, UpdatePermissionRequest dto, Guid? updatedBy, CancellationToken ct = default)
    {
        var entity = await _permissionRepo.GetByIdWithTrackingAsync(id, ct)
            ?? throw new KeyNotFoundException($"Permission {id} not found.");

        if (entity.IsSystem)
        {
            if (dto.PermissionCode != null)
                throw new InvalidOperationException("Cannot modify the code of a system permission.");
            if (dto.IsPublic.HasValue)
                throw new InvalidOperationException("Cannot modify the public flag of a system permission.");
        }

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

        await _permissionRepo.SaveChangesAsync(ct);
        return PermissionMapper.ToResponse(entity);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _permissionRepo.GetByIdWithTrackingAsync(id, ct);
        if (entity == null) return false;
        if (entity.IsSystem)
            throw new InvalidOperationException("Cannot delete system permission.");

        await _permissionRepo.RemoveAsync(entity, ct);
        await _permissionRepo.SaveChangesAsync(ct);
        return true;
    }

    public async Task<List<PermissionResponse>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default)
    {
        var entities = await _permissionRepo.GetByIdsAsync(ids, ct);
        return entities.Select(PermissionMapper.ToResponse).ToList();
    }

    public async Task<List<string>> GetDistinctResourcesAsync(CancellationToken ct = default)
    {
        return await _permissionRepo.GetDistinctResourcesAsync(ct);
    }
}
