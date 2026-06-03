using AuthModule.DTOs;

namespace AuthModule.Services;

public interface IAuthService
{
    Task<AuthenticatedUserDto> LoginOrCreateUserAsync(LoginDto loginDto, CancellationToken cancellationToken = default);

    Task<List<UserPermissionDto>> GetPermissionsAsync(Guid accountId, CancellationToken cancellationToken = default);
}
