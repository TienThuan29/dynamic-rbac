using AuthModule.Dal.Entities;
using AuthModule.Dal.Repositories;
using AuthModule.DTOs;

namespace AuthModule.Services;

public interface IAuthService
{
    Task<AuthenticatedUserDto> LoginOrCreateUserAsync(LoginDto loginDto, CancellationToken cancellationToken = default);
    Task<List<UserPermissionDto>> GetPermissionsAsync(Guid accountId, CancellationToken cancellationToken = default);
}


public class AuthService : IAuthService
{
    private readonly IAccountRepository _accountRepo;
    private readonly IUserRepository _userRepo;
    private readonly IUserPermissionRepository _userPermRepo;

    public AuthService(
        IAccountRepository accountRepo,
        IUserRepository userRepo,
        IUserPermissionRepository userPermRepo)
    {
        _accountRepo = accountRepo;
        _userRepo = userRepo;
        _userPermRepo = userPermRepo;
    }

    public async Task<AuthenticatedUserDto> LoginOrCreateUserAsync(
        LoginDto loginDto, CancellationToken ct = default)
    {
        var existingAccount = await _accountRepo.GetByEntraIdAsync(loginDto.EntraIdObjectId, ct);

        if (existingAccount?.User != null)
        {
            UpdateExistingAccount(existingAccount, loginDto);
            await _accountRepo.SaveChangesAsync(ct);

            return new AuthenticatedUserDto
            {
                UserId = existingAccount.User.Id,
                AccountId = existingAccount.Id,
                Email = existingAccount.Email,
                FullName = existingAccount.User.FullName,
                Role = string.IsNullOrWhiteSpace(existingAccount.Role) ? "User" : existingAccount.Role,
                IsNewAccount = false
            };
        }

        var accountId = Guid.NewGuid();

        var newAccount = new Account
        {
            Id = accountId,
            EntraIdObjectId = loginDto.EntraIdObjectId,
            Email = loginDto.Email,
            Username = loginDto.Email.Split('@')[0],
            Role = "User",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var newUser = new User
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            FullName = loginDto.Email.Split('@')[0],
            Email = loginDto.Email,
            CreatedAt = DateTime.UtcNow
        };

        await _accountRepo.AddAsync(newAccount, ct);
        await _userRepo.AddAsync(newUser, ct);
        await _accountRepo.SaveChangesAsync(ct);

        return new AuthenticatedUserDto
        {
            UserId = newUser.Id,
            AccountId = newAccount.Id,
            Email = newAccount.Email,
            FullName = newUser.FullName,
            Role = newAccount.Role,
            IsNewAccount = true
        };
    }

    public async Task<List<UserPermissionDto>> GetPermissionsAsync(
        Guid accountId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        return await _userPermRepo
            .GetByAccountIdWithPermissionAsync(accountId, ct)
            .ContinueWith(t => t.Result
                .Where(up => up.ExpiresAt == null || up.ExpiresAt > now)
                .Where(up => up.Permission.IsActive)
                .Select(up => new UserPermissionDto
                {
                    AccountId = up.AccountId,
                    PermissionId = up.PermissionId,
                    PermissionCode = up.Permission.PermissionCode,
                    PermissionName = up.Permission.PermissionName,
                    Method = up.Permission.Method,
                    Endpoint = up.Permission.Endpoint,
                    IsPublic = up.Permission.IsPublic,
                    AssignedAt = up.AssignedAt,
                    ExpiresAt = up.ExpiresAt
                })
                .ToList(), ct);
    }

    private static void UpdateExistingAccount(Account account, LoginDto loginDto)
    {
        account.UpdatedAt = DateTime.UtcNow;
        account.Email = loginDto.Email;
        account.Username = loginDto.Email.Split('@')[0];

        if (account.User != null)
        {
            account.User.UpdatedAt = DateTime.UtcNow;
            account.User.Email = loginDto.Email;
        }
    }
}
