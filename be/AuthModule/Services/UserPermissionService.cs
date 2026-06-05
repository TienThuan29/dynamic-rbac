using AuthModule.Dal.Entities;
using AuthModule.Dal.Repositories;
using AuthModule.DTOs.Common;
using AuthModule.DTOs.Requests;
using AuthModule.DTOs.Responses;
using AuthModule.Mappers;

namespace AuthModule.Services;

public interface IUserPermissionService
{
    Task<List<UserPermissionDetailResponse>> GetByAccountIdAsync(Guid accountId, CancellationToken ct = default);
    Task<PagedResult<UserAccountResponse>> GetAccountsAsync(int page, int pageSize, string? search, CancellationToken ct = default);
    Task<List<UserPermissionDetailResponse>> AssignPermissionAsync(AssignUserPermissionRequest dto, Guid assignedBy, CancellationToken ct = default);
    Task<bool> RevokePermissionAsync(Guid accountId, Guid permissionId, CancellationToken ct = default);
    Task<List<UserPermissionDetailResponse>> AssignByGroupAsync(AssignByGroupRequest dto, Guid assignedBy, CancellationToken ct = default);
    Task<int> RevokeAllByGroupAsync(Guid accountId, Guid permissionGroupId, CancellationToken ct = default);
}

public class UserPermissionService : IUserPermissionService
{
    private readonly IUserPermissionRepository _userPermRepo;
    private readonly IAccountRepository _accountRepo;
    private readonly IPermissionGroupService _groupService;

    public UserPermissionService(
        IUserPermissionRepository userPermRepo,
        IAccountRepository accountRepo,
        IPermissionGroupService groupService)
    {
        _userPermRepo = userPermRepo;
        _accountRepo = accountRepo;
        _groupService = groupService;
    }

    public async Task<List<UserPermissionDetailResponse>> GetByAccountIdAsync(
        Guid accountId, CancellationToken ct = default)
    {
        var entities = await _userPermRepo.GetByAccountIdWithPermissionAsync(accountId, ct);
        return entities.Select(UserPermissionMapper.ToDetailResponse).ToList();
    }

    public async Task<PagedResult<UserAccountResponse>> GetAccountsAsync(
        int page, int pageSize, string? search, CancellationToken ct = default)
    {
        var (items, totalCount) = await _accountRepo.GetAllAsync(page, pageSize, search, ct);

        return new PagedResult<UserAccountResponse>
        {
            Items = items.Select(a => new UserAccountResponse
            {
                AccountId = a.Id,
                Username = a.Username,
                Email = a.Email,
                Role = a.Role,
                IsActive = a.IsActive,
                FullName = a.User != null ? a.User.FullName : null
            }).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<List<UserPermissionDetailResponse>> AssignPermissionAsync(
        AssignUserPermissionRequest dto, Guid assignedBy, CancellationToken ct = default)
    {
        if (dto.PermissionIds == null || dto.PermissionIds.Count == 0)
            return await GetByAccountIdAsync(dto.AccountId, ct);

        var existingIds = await _userPermRepo.GetExistingIdsAsync(dto.AccountId, dto.PermissionIds, ct);
        var toAdd = dto.PermissionIds.Except(existingIds).ToList();
        if (toAdd.Count == 0)
            return await GetByAccountIdAsync(dto.AccountId, ct);

        var now = DateTime.UtcNow;
        var newEntries = toAdd.Select(pid => new UserPermission
        {
            AccountId = dto.AccountId,
            PermissionId = pid,
            AssignedAt = now,
            AssignedBy = assignedBy,
            ExpiresAt = dto.ExpiresAt
        }).ToList();

        await _userPermRepo.AddRangeAsync(newEntries, ct);
        await _userPermRepo.SaveChangesAsync(ct);

        return await GetByAccountIdAsync(dto.AccountId, ct);
    }

    public async Task<bool> RevokePermissionAsync(
        Guid accountId, Guid permissionId, CancellationToken ct = default)
    {
        var entities = await _userPermRepo.GetByAccountIdAsync(accountId, ct);
        var entity = entities.FirstOrDefault(up => up.PermissionId == permissionId);
        if (entity == null) return false;

        await _userPermRepo.RemoveAsync(entity, ct);
        await _userPermRepo.SaveChangesAsync(ct);
        return true;
    }

    public async Task<List<UserPermissionDetailResponse>> AssignByGroupAsync(
        AssignByGroupRequest dto, Guid assignedBy, CancellationToken ct = default)
    {
        var group = await _groupService.GetByIdAsync(dto.PermissionGroupId, ct)
            ?? throw new KeyNotFoundException($"PermissionGroup {dto.PermissionGroupId} not found.");

        if (group.Permissions.Count == 0)
            return new List<UserPermissionDetailResponse>();

        var permissionIdGuids = group.Permissions.Select(p => p.Id).ToList();
        var existingIds = await _userPermRepo.GetExistingIdsAsync(dto.AccountId, permissionIdGuids, ct);
        var toAssign = permissionIdGuids.Except(existingIds).ToList();
        if (toAssign.Count == 0)
            return await GetByAccountIdAsync(dto.AccountId, ct);

        var now = DateTime.UtcNow;
        var newEntries = toAssign.Select(pid => new UserPermission
        {
            AccountId = dto.AccountId,
            PermissionId = pid,
            AssignedAt = now,
            AssignedBy = assignedBy,
            ExpiresAt = dto.ExpiresAt
        }).ToList();

        await _userPermRepo.AddRangeAsync(newEntries, ct);
        await _userPermRepo.SaveChangesAsync(ct);

        return await GetByAccountIdAsync(dto.AccountId, ct);
    }

    public async Task<int> RevokeAllByGroupAsync(
        Guid accountId, Guid permissionGroupId, CancellationToken ct = default)
    {
        var group = await _groupService.GetByIdAsync(permissionGroupId, ct);
        if (group == null) return 0;

        var permissionIdGuids = group.Permissions.Select(p => p.Id).ToList();
        if (permissionIdGuids.Count == 0) return 0;

        var allUp = await _userPermRepo.GetByAccountIdAsync(accountId, ct);
        var toRemove = allUp.Where(up => permissionIdGuids.Contains(up.PermissionId)).ToList();
        if (toRemove.Count == 0) return 0;

        await _userPermRepo.RemoveRangeAsync(toRemove, ct);
        await _userPermRepo.SaveChangesAsync(ct);
        return toRemove.Count;
    }
}
