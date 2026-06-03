using AuthModule.DTOs;

namespace AuthModule.Services;

public interface IUserPermissionService
{
    Task<List<UserPermissionDetailDto>> GetByAccountIdAsync(Guid accountId, CancellationToken ct = default);
    Task<PagedResult<UserAccountDto>> GetAccountsAsync(int page, int pageSize, string? search, CancellationToken ct = default);
    Task<List<UserPermissionDetailDto>> AssignPermissionAsync(AssignUserPermissionDto dto, Guid assignedBy, CancellationToken ct = default);
    Task<bool> RevokePermissionAsync(Guid accountId, Guid permissionId, CancellationToken ct = default);
    Task<List<UserPermissionDetailDto>> AssignByGroupAsync(AssignByGroupDto dto, Guid assignedBy, CancellationToken ct = default);
    Task<int> RevokeAllByGroupAsync(Guid accountId, Guid permissionGroupId, CancellationToken ct = default);
}
