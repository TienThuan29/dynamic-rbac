using AuthModule.Dal.Entities;
using AuthModule.DTOs;

namespace AuthModule.Mappers;

public static class UserPermissionMapper
{
    public static UserPermissionDetailDto ToDetailDto(UserPermission up) => new()
    {
        AccountId = up.AccountId,
        PermissionId = up.PermissionId,
        PermissionCode = up.Permission.PermissionCode,
        PermissionName = up.Permission.PermissionName,
        Method = up.Permission.Method,
        Endpoint = up.Permission.Endpoint,
        Description = up.Permission.Description,
        IsPublic = up.Permission.IsPublic,
        AssignedAt = up.AssignedAt,
        AssignedBy = up.AssignedBy,
        ExpiresAt = up.ExpiresAt
    };
}
