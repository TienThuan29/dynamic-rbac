using AuthModule.DTOs;

namespace AuthModule.Services;

public interface IPermissionGroupService
{
    Task<PermissionGroupDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<PermissionGroupDto>> GetAllAsync(int page, int pageSize, string? search, CancellationToken ct = default);
    Task<PermissionGroupDto> CreateAsync(CreatePermissionGroupDto dto, Guid? createdBy, CancellationToken ct = default);
    Task<PermissionGroupDto> UpdateAsync(Guid id, UpdatePermissionGroupDto dto, Guid? updatedBy, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}
