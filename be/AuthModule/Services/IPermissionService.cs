using AuthModule.DTOs;

namespace AuthModule.Services;

public interface IPermissionService
{
    Task<PermissionDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<PermissionDto>> GetAllAsync(int page, int pageSize, string? search, string? method, bool? isSystem, bool? isActive, string? resource, CancellationToken ct = default);
    Task<List<string>> GetDistinctResourcesAsync(CancellationToken ct = default);
    Task<PermissionDto> UpdateAsync(Guid id, UpdatePermissionDto dto, Guid? updatedBy, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<List<PermissionDto>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default);
}
