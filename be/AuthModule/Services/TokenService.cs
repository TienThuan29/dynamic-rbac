using AuthModule.Dal.Entities;
using AuthModule.Dal.Repositories;
using AuthModule.DTOs.Common;
using AuthModule.DTOs.Requests;
using AuthModule.DTOs.Responses;
using AuthModule.Mappers;

namespace AuthModule.Services;

public interface ITokenAppService
{
    Task<PagedResult<TokenResponse>> GetAllAsync(
        Guid? currentAccountId, bool isAdmin,
        int page, int pageSize, bool? isRevoked,
        CancellationToken ct = default);

    Task<TokenResponse?> GetByIdAsync(Guid id, Guid? currentAccountId, bool isAdmin, CancellationToken ct = default);

    Task<CreateTokenResponse> CreateAsync(CreateTokenRequest input, CancellationToken ct = default);

    Task<RefreshTokenResponse> RefreshAsync(Guid id, Guid? currentAccountId, bool isAdmin,
        int? extendMinutes, CancellationToken ct = default);

    Task RevokeAsync(Guid id, Guid? currentAccountId, bool isAdmin, CancellationToken ct = default);

    Task DeleteAsync(Guid id, Guid? currentAccountId, bool isAdmin, CancellationToken ct = default);

    Task<TokenResponse> AddPermissionsAsync(Guid id, List<Guid> permissionIds,
        Guid? currentAccountId, bool isAdmin, CancellationToken ct = default);

    Task RemovePermissionAsync(Guid id, Guid permissionId,
        Guid? currentAccountId, bool isAdmin, CancellationToken ct = default);
}

public class TokenAppService : ITokenAppService
{
    private readonly ITokenRepository _tokenRepo;
    private readonly ITokenPermissionRepository _tokenPermRepo;
    private readonly IAccountRepository _accountRepo;
    private readonly IJwtUtil _jwtUtil;
    private readonly ILogger<TokenAppService> _logger;

    public TokenAppService(
        ITokenRepository tokenRepo,
        ITokenPermissionRepository tokenPermRepo,
        IAccountRepository accountRepo,
        IJwtUtil jwtUtil,
        ILogger<TokenAppService> logger)
    {
        _tokenRepo = tokenRepo;
        _tokenPermRepo = tokenPermRepo;
        _accountRepo = accountRepo;
        _jwtUtil = jwtUtil;
        _logger = logger;
    }

    public async Task<PagedResult<TokenResponse>> GetAllAsync(
        Guid? currentAccountId, bool isAdmin,
        int page, int pageSize, bool? isRevoked,
        CancellationToken ct = default)
    {
        var (items, totalCount) = await _tokenRepo.GetAllAsync(currentAccountId, isAdmin, page, pageSize, isRevoked, ct);

        return new PagedResult<TokenResponse>
        {
            Items = items.Select(TokenMapper.ToResponse).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<TokenResponse?> GetByIdAsync(Guid id, Guid? currentAccountId, bool isAdmin, CancellationToken ct = default)
    {
        var token = await _tokenRepo.GetByIdAsync(id, ct);
        if (token == null) return null;

        if (!isAdmin && token.AccountId != currentAccountId)
            throw new UnauthorizedAccessException();

        return TokenMapper.ToResponse(token);
    }

    public async Task<CreateTokenResponse> CreateAsync(CreateTokenRequest input, CancellationToken ct = default)
    {
        var account = await _accountRepo.GetByIdAsync(input.AccountId, ct)
            ?? throw new KeyNotFoundException($"Account {input.AccountId} not found.");

        if (!account.IsActive)
            throw new InvalidOperationException("Account is inactive.");

        var now = DateTime.UtcNow;
        var expiresAt = input.ExpiresInMinutes.HasValue
            ? now.AddMinutes(input.ExpiresInMinutes.Value)
            : (DateTime?)null;

        var userId = account.User?.Id ?? account.Id;
        var rawJwt = _jwtUtil.GenerateJwtToken(userId, account.Id, account.Email, account.Role);
        var tokenHash = ComputeJwtHash(rawJwt);

        var token = new Token
        {
            AccountId = input.AccountId,
            TokenHash = tokenHash,
            TokenType = "Bearer",
            ExpiresAt = expiresAt,
            IssuedAt = now,
            IpAddress = input.IpAddress,
            UserAgent = input.UserAgent,
            IsRevoked = false
        };

        await _tokenRepo.AddAsync(token, ct);

        if (input.PermissionIds.Count > 0)
        {
            var tokenPerms = input.PermissionIds.Select(pid => new TokenPermission
            {
                TokenId = token.Id,
                PermissionId = pid,
                GrantedAt = now,
                ExpiresAt = expiresAt
            }).ToList();
            await _tokenPermRepo.AddRangeAsync(tokenPerms, ct);
        }

        await _tokenRepo.SaveChangesAsync(ct);

        _logger.LogInformation("Token {TokenId} created for account {AccountId}", token.Id, input.AccountId);

        return new CreateTokenResponse
        {
            Id = token.Id,
            AccountId = token.AccountId,
            TokenType = token.TokenType,
            ExpiresAt = token.ExpiresAt,
            IssuedAt = token.IssuedAt,
            IpAddress = token.IpAddress,
            UserAgent = token.UserAgent,
            RawJwt = rawJwt,
            Permissions = input.PermissionIds
        };
    }

    public async Task<RefreshTokenResponse> RefreshAsync(
        Guid id, Guid? currentAccountId, bool isAdmin,
        int? extendMinutes, CancellationToken ct = default)
    {
        var token = await _tokenRepo.GetByIdForUpdateAsync(id, ct)
            ?? throw new KeyNotFoundException($"Token {id} not found.");

        if (!isAdmin && token.AccountId != currentAccountId)
            throw new UnauthorizedAccessException();

        if (token.IsRevoked)
            throw new InvalidOperationException("Cannot refresh a revoked token.");

        var account = await _accountRepo.GetByIdAsync(token.AccountId, ct)
            ?? throw new KeyNotFoundException("Token account not found.");

        var userId = account.User?.Id ?? account.Id;
        var rawJwt = _jwtUtil.GenerateJwtToken(userId, account.Id, account.Email, account.Role);
        token.TokenHash = ComputeJwtHash(rawJwt);
        token.IssuedAt = DateTime.UtcNow;

        if (extendMinutes.HasValue)
            token.ExpiresAt = DateTime.UtcNow.AddMinutes(extendMinutes.Value);

        await _tokenRepo.SaveChangesAsync(ct);

        _logger.LogInformation("Token {TokenId} refreshed", id);

        return new RefreshTokenResponse
        {
            RawJwt = rawJwt,
            ExpiresAt = token.ExpiresAt
        };
    }

    public async Task RevokeAsync(Guid id, Guid? currentAccountId, bool isAdmin, CancellationToken ct = default)
    {
        var token = await _tokenRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Token {id} not found.");

        if (!isAdmin && token.AccountId != currentAccountId)
            throw new UnauthorizedAccessException();

        if (token.IsRevoked)
            throw new InvalidOperationException("Token is already revoked.");

        await _tokenRepo.RevokeAsync(id, ct);
        await _tokenRepo.SaveChangesAsync(ct);

        _logger.LogInformation("Token {TokenId} revoked", id);
    }

    public async Task DeleteAsync(Guid id, Guid? currentAccountId, bool isAdmin, CancellationToken ct = default)
    {
        var token = await _tokenRepo.GetByIdForDeleteAsync(id, ct)
            ?? throw new KeyNotFoundException($"Token {id} not found.");

        if (!isAdmin && token.AccountId != currentAccountId)
            throw new UnauthorizedAccessException();

        if (!token.IsRevoked)
            throw new InvalidOperationException("Only revoked tokens can be deleted. Use the revoke endpoint first.");

        await _tokenPermRepo.RemoveByTokenIdAsync(id, ct);
        await _tokenRepo.RemoveAsync(token, ct);
        await _tokenRepo.SaveChangesAsync(ct);

        _logger.LogInformation("Token {TokenId} deleted", id);
    }

    public async Task<TokenResponse> AddPermissionsAsync(
        Guid id, List<Guid> permissionIds,
        Guid? currentAccountId, bool isAdmin, CancellationToken ct = default)
    {
        var token = await _tokenRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Token {id} not found.");

        if (!isAdmin && token.AccountId != currentAccountId)
            throw new UnauthorizedAccessException();

        if (token.IsRevoked)
            throw new InvalidOperationException("Cannot add permissions to a revoked token.");

        var now = DateTime.UtcNow;
        var entities = permissionIds.Select(pid => new TokenPermission
        {
            TokenId = id,
            PermissionId = pid,
            GrantedAt = now,
            ExpiresAt = token.ExpiresAt
        }).ToList();

        await _tokenPermRepo.AddRangeAsync(entities, ct);
        await _tokenPermRepo.SaveChangesAsync(ct);

        _logger.LogInformation("Added {Count} permissions to token {TokenId}", permissionIds.Count, id);

        var updated = await _tokenRepo.GetByIdAsync(id, ct);
        return TokenMapper.ToResponse(updated!);
    }

    public async Task RemovePermissionAsync(
        Guid id, Guid permissionId,
        Guid? currentAccountId, bool isAdmin, CancellationToken ct = default)
    {
        var token = await _tokenRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Token {id} not found.");

        if (!isAdmin && token.AccountId != currentAccountId)
            throw new UnauthorizedAccessException();

        var tp = await _tokenPermRepo.GetByTokenIdAsync(id, ct);
        var target = tp.FirstOrDefault(p => p.PermissionId == permissionId)
            ?? throw new KeyNotFoundException($"Permission {permissionId} not found on token {id}.");

        await _tokenPermRepo.RemoveAsync(target, ct);
        await _tokenPermRepo.SaveChangesAsync(ct);

        _logger.LogInformation("Removed permission {PermissionId} from token {TokenId}", permissionId, id);
    }

    private static string ComputeJwtHash(string rawJwt)
    {
        return Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(rawJwt))).ToLowerInvariant();
    }
}
