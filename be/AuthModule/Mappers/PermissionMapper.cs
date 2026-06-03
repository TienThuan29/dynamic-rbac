using AuthModule.Dal.Entities;
using AuthModule.DTOs;

namespace AuthModule.Mappers;

public static class PermissionMapper
{
    public static PermissionDto ToDto(Permission p) => new()
    {
        Id = p.Id,
        Method = p.Method,
        Endpoint = p.Endpoint,
        PermissionName = p.PermissionName,
        PermissionCode = p.PermissionCode,
        Description = p.Description,
        IsPublic = p.IsPublic,
        IsSystem = p.IsSystem,
        IsActive = p.IsActive,
        CreatedBy = p.CreatedBy,
        UpdatedBy = p.UpdatedBy,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}
