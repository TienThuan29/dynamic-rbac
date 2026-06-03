using AuthModule.Dal.Entities;
using AuthModule.Data;
using AuthModule.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Services;

public class AuthService : IAuthService
{
    private readonly AuthDbContext _dbContext;

    public AuthService(AuthDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<AuthenticatedUserDto> LoginOrCreateUserAsync(
        LoginDto loginDto,
        CancellationToken cancellationToken = default)
    {
        var existingAccount = await _dbContext.Accounts
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.EntraIdObjectId == loginDto.EntraIdObjectId, cancellationToken);

        if (existingAccount?.User != null)
        {
            UpdateExistingAccount(existingAccount, loginDto);
            await _dbContext.SaveChangesAsync(cancellationToken);

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

        newAccount.User = newUser;

        _dbContext.Accounts.Add(newAccount);
        _dbContext.Users.Add(newUser);
        await _dbContext.SaveChangesAsync(cancellationToken);

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
        Guid accountId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        return await _dbContext.UserPermissions
            .AsNoTracking()
            .Where(up => up.AccountId == accountId &&
                         (up.ExpiresAt == null || up.ExpiresAt > now) &&
                         up.Permission.IsActive)
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
            .ToListAsync(cancellationToken);
    }

    private static void UpdateExistingAccount(Account account, LoginDto loginDto)
    {
        account.UpdatedAt = DateTime.UtcNow;
        account.Email = loginDto.Email;
        account.Username = loginDto.Email.Split('@')[0];

        account.User!.UpdatedAt = DateTime.UtcNow;
        account.User.Email = loginDto.Email;
    }
}
