using AuthModule.Dal.Entities;
using AuthModule.Dal.Repositories;
using AuthModule.DTOs;
using AuthModule.Mappers;

namespace AuthModule.Services;

public interface IPermissionGroupService
{
    Task<PermissionGroupDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<PermissionGroupDto>> GetAllAsync(int page, int pageSize, string? search, CancellationToken ct = default);
    Task<PermissionGroupDto> CreateAsync(CreatePermissionGroupDto dto, Guid? createdBy, CancellationToken ct = default);
    Task<PermissionGroupDto> UpdateAsync(Guid id, UpdatePermissionGroupDto dto, Guid? updatedBy, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public class PermissionGroupService : IPermissionGroupService
{
    private readonly IPermissionGroupRepository _groupRepo;
    private readonly IPermissionService _permissionService;

    public PermissionGroupService(
        IPermissionGroupRepository groupRepo,
        IPermissionService permissionService)
    {
        _groupRepo = groupRepo;
        _permissionService = permissionService;
    }

    public async Task<PermissionGroupDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _groupRepo.GetByIdAsync(id, ct);
        return entity == null ? null : await PermissionGroupMapper.ToDtoAsync(entity, _permissionService, ct);
    }

    public async Task<PagedResult<PermissionGroupDto>> GetAllAsync(
        int page, int pageSize, string? search, CancellationToken ct = default)
    {
        var (items, totalCount) = await _groupRepo.GetAllAsync(page, pageSize, search, ct);

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

        await _groupRepo.AddAsync(entity, ct);
        await _groupRepo.SaveChangesAsync(ct);

        return await PermissionGroupMapper.ToDtoAsync(entity, _permissionService, ct);
    }

    public async Task<PermissionGroupDto> UpdateAsync(
        Guid id, UpdatePermissionGroupDto dto, Guid? updatedBy, CancellationToken ct = default)
    {
        var entity = await _groupRepo.GetByIdWithTrackingAsync(id, ct)
            ?? throw new KeyNotFoundException($"PermissionGroup {id} not found.");

        if (dto.GroupName != null)
            entity.GroupName = dto.GroupName.Trim();
        if (dto.PermissionIds != null)
            entity.PermissionIds = dto.PermissionIds;
        if (dto.Description != null)
            entity.Description = dto.Description.Trim();

        entity.UpdatedBy = updatedBy;
        entity.UpdatedAt = DateTime.UtcNow;

        await _groupRepo.SaveChangesAsync(ct);
        return await PermissionGroupMapper.ToDtoAsync(entity, _permissionService, ct);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _groupRepo.GetByIdWithTrackingAsync(id, ct);
        if (entity == null) return false;

        await _groupRepo.RemoveAsync(entity, ct);
        await _groupRepo.SaveChangesAsync(ct);
        return true;
    }
}
