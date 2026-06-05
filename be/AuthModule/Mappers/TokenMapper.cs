using AuthModule.Dal.Entities;
using AuthModule.DTOs.Responses;

namespace AuthModule.Mappers;

public static class TokenMapper
{
    public static TokenResponse ToResponse(Token t) => new()
    {
        Id = t.Id,
        AccountId = t.AccountId,
        TokenType = t.TokenType,
        ExpiresAt = t.ExpiresAt,
        IsRevoked = t.IsRevoked,
        IssuedAt = t.IssuedAt,
        IpAddress = t.IpAddress,
        UserAgent = t.UserAgent,
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
