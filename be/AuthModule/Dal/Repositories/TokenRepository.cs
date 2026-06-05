using AuthModule.Data;
using AuthModule.Dal.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Dal.Repositories;

public interface ITokenRepository : IRepository
{
    Task<Token?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Token?> GetByIdForDeleteAsync(Guid id, CancellationToken ct = default);
    Task<Token?> GetByIdForUpdateAsync(Guid id, CancellationToken ct = default);
    Task<Token?> GetByHashAsync(string tokenHash, CancellationToken ct = default);
    Task<List<Token>> GetActiveByAccountIdAsync(Guid accountId, CancellationToken ct = default);
    Task<(List<Token> Items, int TotalCount)> GetAllAsync(
        Guid? currentAccountId, bool isAdmin,
        int page, int pageSize, bool? isRevoked,
        CancellationToken ct = default);
    Task<Token> AddAsync(Token token, CancellationToken ct = default);
    Task RevokeAsync(Guid tokenId, CancellationToken ct = default);
    Task RevokeAllForAccountAsync(Guid accountId, CancellationToken ct = default);
    Task RemoveAsync(Token token, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}

public class TokenRepository : ITokenRepository
{
    private readonly AuthDbContext _db;

    public TokenRepository(AuthDbContext db)
    {
        _db = db;
    }

    public DbContext DbContext => _db;

    public async Task<Token?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Tokens
            .AsNoTracking()
            .Include(t => t.TokenPermissions)
                .ThenInclude(tp => tp.Permission)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    public async Task<Token?> GetByIdForDeleteAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Tokens
            .Include(t => t.TokenPermissions)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    public async Task<Token?> GetByIdForUpdateAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Tokens
            .FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    public async Task<Token?> GetByHashAsync(string tokenHash, CancellationToken ct = default)
    {
        return await _db.Tokens
            .AsNoTracking()
            .Include(t => t.TokenPermissions)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);
    }

    public async Task<List<Token>> GetActiveByAccountIdAsync(Guid accountId, CancellationToken ct = default)
    {
        return await _db.Tokens
            .AsNoTracking()
            .Where(t => t.AccountId == accountId && !t.IsRevoked)
            .ToListAsync(ct);
    }

    public async Task<(List<Token> Items, int TotalCount)> GetAllAsync(
        Guid? currentAccountId, bool isAdmin,
        int page, int pageSize, bool? isRevoked,
        CancellationToken ct = default)
    {
        var query = _db.Tokens.AsNoTracking();

        if (!isAdmin && currentAccountId.HasValue)
            query = query.Where(t => t.AccountId == currentAccountId.Value);

        if (isRevoked.HasValue)
            query = query.Where(t => t.IsRevoked == isRevoked.Value);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .Include(t => t.TokenPermissions)
                .ThenInclude(tp => tp.Permission)
            .OrderByDescending(t => t.IssuedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<Token> AddAsync(Token token, CancellationToken ct = default)
    {
        await _db.Tokens.AddAsync(token, ct);
        return token;
    }

    public async Task RevokeAsync(Guid tokenId, CancellationToken ct = default)
    {
        var token = await _db.Tokens.FindAsync(new object[] { tokenId }, ct);
        if (token != null)
            token.IsRevoked = true;
    }

    public async Task RevokeAllForAccountAsync(Guid accountId, CancellationToken ct = default)
    {
        await _db.Tokens
            .Where(t => t.AccountId == accountId && !t.IsRevoked)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsRevoked, true), ct);
    }

    public async Task RemoveAsync(Token token, CancellationToken ct = default)
    {
        _db.Tokens.Remove(token);
        await Task.CompletedTask;
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _db.SaveChangesAsync(ct);
    }
}
