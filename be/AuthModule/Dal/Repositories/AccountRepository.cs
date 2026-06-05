using AuthModule.Data;
using AuthModule.Dal.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuthModule.Dal.Repositories;

public interface IAccountRepository : IRepository
{
    Task<Account?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Account?> GetByEntraIdAsync(string entraIdObjectId, CancellationToken ct = default);
    Task<(List<Account> Items, int TotalCount)> GetAllAsync(
        int page, int pageSize, string? search, CancellationToken ct = default);
    Task AddAsync(Account account, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}

public class AccountRepository : IAccountRepository
{
    private readonly AuthDbContext _db;

    public AccountRepository(AuthDbContext db)
    {
        _db = db;
    }

    public DbContext DbContext => _db;

    public async Task<Account?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Accounts
            .AsNoTracking()
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
    }

    public async Task<Account?> GetByEntraIdAsync(string entraIdObjectId, CancellationToken ct = default)
    {
        return await _db.Accounts
            .AsNoTracking()
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.EntraIdObjectId == entraIdObjectId, ct);
    }

    public async Task<(List<Account> Items, int TotalCount)> GetAllAsync(
        int page, int pageSize, string? search, CancellationToken ct = default)
    {
        var query = _db.Accounts
            .AsNoTracking()
            .Include(a => a.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(a =>
                a.Username.ToLower().Contains(s) ||
                a.Email.ToLower().Contains(s) ||
                (a.User != null && a.User.FullName != null && a.User.FullName.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task AddAsync(Account account, CancellationToken ct = default)
    {
        await _db.Accounts.AddAsync(account, ct);
    }

    public async Task SaveChangesAsync(CancellationToken ct = default)
    {
        await _db.SaveChangesAsync(ct);
    }
}
