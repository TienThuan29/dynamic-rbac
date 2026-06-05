using AuthModule.Dal.Entities;
using AuthModule.DTOs.Responses;

namespace AuthModule.Mappers;

public static class TokenMapper
{
    public static TokenResponse ToResponse(Token t) => new()
    {
        Id = t.Id,
        CreatedById = t.CreatedBy,
        CreatedByEmail = t.CreatedByAccount?.Email,
        CreatedByUsername = t.CreatedByAccount?.Username,
        AccountId = t.AccountId,
        AccountEmail = t.Account?.Email,
        AccountUsername = t.Account?.Username,
        TokenType = t.TokenType,
        ExpiresAt = t.ExpiresAt,
        IsRevoked = t.IsRevoked,
        Permissions = t.TokenPermissions?.Select(tp => new TokenPermissionResponse
        {
            PermissionId = tp.PermissionId,
            PermissionCode = tp.Permission?.PermissionCode,
            PermissionName = tp.Permission?.PermissionName,
            Method = tp.Permission?.Method,
            Endpoint = tp.Permission?.Endpoint,
            GrantedAt = tp.GrantedAt,
            ExpiresAt = tp.ExpiresAt
        }).ToList() ?? new()
    };
}
