using AuthModule.Data;
using AuthModule.Dal.Entities;
using AuthModule.DTOs;
using AuthModule.Mappers;
using Microsoft.EntityFrameworkCore;

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

public class UserPermissionService : IUserPermissionService
{
    private readonly AuthDbContext _db;
    private readonly IPermissionGroupService _groupService;

    public UserPermissionService(AuthDbContext db, IPermissionGroupService groupService)
    {
        _db = db;
        _groupService = groupService;
    }

    public async Task<List<UserPermissionDetailDto>> GetByAccountIdAsync(
        Guid accountId, CancellationToken ct = default)
    {
        return await _db.UserPermissions
            .AsNoTracking()
            .Where(up => up.AccountId == accountId)
            .Include(up => up.Permission)
            .Select(up => UserPermissionMapper.ToDetailDto(up))
            .ToListAsync(ct);
    }

    public async Task<PagedResult<UserAccountDto>> GetAccountsAsync(
        int page, int pageSize, string? search, CancellationToken ct = default)
    {
        var query = _db.Accounts
            .AsNoTracking()
            .Include(a => a.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(a =>
                a.Username.ToLower().Contains(s) ||
                a.Email.ToLower().Contains(s) ||
                (a.User != null && a.User.FullName != null && a.User.FullName.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new UserAccountDto
            {
                AccountId = a.Id,
                Username = a.Username,
                Email = a.Email,
                Role = a.Role,
                IsActive = a.IsActive,
                FullName = a.User != null ? a.User.FullName : null
            })
            .ToListAsync(ct);

        return new PagedResult<UserAccountDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<List<UserPermissionDetailDto>> AssignPermissionAsync(
        AssignUserPermissionDto dto, Guid assignedBy, CancellationToken ct = default)
    {
        if (dto.PermissionIds == null || dto.PermissionIds.Count == 0)
            return await GetByAccountIdAsync(dto.AccountId, ct);

        var existingIds = await _db.UserPermissions
            .Where(up => up.AccountId == dto.AccountId && dto.PermissionIds.Contains(up.PermissionId))
            .Select(up => up.PermissionId)
            .ToListAsync(ct);

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

        _db.UserPermissions.AddRange(newEntries);
        await _db.SaveChangesAsync(ct);

        return await GetByAccountIdAsync(dto.AccountId, ct);
    }

    public async Task<bool> RevokePermissionAsync(
        Guid accountId, Guid permissionId, CancellationToken ct = default)
    {
        var entity = await _db.UserPermissions
            .FirstOrDefaultAsync(up => up.AccountId == accountId && up.PermissionId == permissionId, ct);
        if (entity == null) return false;

        _db.UserPermissions.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<List<UserPermissionDetailDto>> AssignByGroupAsync(
        AssignByGroupDto dto, Guid assignedBy, CancellationToken ct = default)
    {
        var group = await _groupService.GetByIdAsync(dto.PermissionGroupId, ct)
            ?? throw new KeyNotFoundException($"PermissionGroup {dto.PermissionGroupId} not found.");

        if (group.Permissions.Count == 0)
            return new List<UserPermissionDetailDto>();

        var permissionIdGuids = group.Permissions.Select(p => p.Id).ToList();
        var existingIds = await _db.UserPermissions
            .Where(up => up.AccountId == dto.AccountId && permissionIdGuids.Contains(up.PermissionId))
            .Select(up => up.PermissionId)
            .ToListAsync(ct);

        var toAssign = permissionIdGuids.Except(existingIds).ToList();
        if (toAssign.Count == 0)
        {
            return await GetByAccountIdAsync(dto.AccountId, ct);
        }

        var now = DateTime.UtcNow;
        var newEntries = toAssign.Select(pid => new UserPermission
        {
            AccountId = dto.AccountId,
            PermissionId = pid,
            AssignedAt = now,
            AssignedBy = assignedBy,
            ExpiresAt = dto.ExpiresAt
        }).ToList();

        _db.UserPermissions.AddRange(newEntries);
        await _db.SaveChangesAsync(ct);

        return await GetByAccountIdAsync(dto.AccountId, ct);
    }

    public async Task<int> RevokeAllByGroupAsync(
        Guid accountId, Guid permissionGroupId, CancellationToken ct = default)
    {
        var group = await _groupService.GetByIdAsync(permissionGroupId, ct);
        if (group == null) return 0;

        var permissionIdGuids = group.Permissions.Select(p => p.Id).ToList();
        if (permissionIdGuids.Count == 0) return 0;

        var toRemove = await _db.UserPermissions
            .Where(up => up.AccountId == accountId && permissionIdGuids.Contains(up.PermissionId))
            .ToListAsync(ct);

        if (toRemove.Count == 0) return 0;

        _db.UserPermissions.RemoveRange(toRemove);
        await _db.SaveChangesAsync(ct);
        return toRemove.Count;
    }
}
