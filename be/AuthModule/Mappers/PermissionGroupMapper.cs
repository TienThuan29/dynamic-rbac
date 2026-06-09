using AuthModule.DTOs.Responses;
using AuthModule.Services;

namespace AuthModule.Mappers;

public static class PermissionGroupMapper
{
    public static async Task<PermissionGroupResponse> ToResponseAsync(
        AuthModule.Dal.Entities.PermissionGroup entity,
        IPermissionService permissionService,
        CancellationToken ct = default)
    {
        var permissionIdGuids = entity.PermissionIds
            .Select(idStr => Guid.TryParse(idStr, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty)
            .ToList();

        var resolvedPermissions = permissionIdGuids.Count > 0
            ? await permissionService.GetByIdsAsync(permissionIdGuids, ct)
            : new List<PermissionResponse>();

        return new PermissionGroupResponse
        {
            Id = entity.Id,
            GroupName = entity.GroupName,
            PermissionIds = entity.PermissionIds,
            Description = entity.Description,
            CreatedBy = entity.CreatedBy,
            UpdatedBy = entity.UpdatedBy,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            Permissions = resolvedPermissions
        };
    }
}
