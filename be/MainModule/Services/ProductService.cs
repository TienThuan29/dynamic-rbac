using MainModule.Dal.Entities;
using MainModule.Data;
using MainModule.DTOs;
using Microsoft.EntityFrameworkCore;

namespace MainModule.Services;

public class ProductService : IProductService
{
    private readonly MainDbContext _db;

    public ProductService(MainDbContext db) => _db = db;

    public async Task<PagedResult<ProductDto>> GetAllAsync(int page, int pageSize, string? category, string? search, CancellationToken ct)
    {
        var query = _db.Products.AsNoTracking().Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(p => p.Category == category);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p => p.Name.Contains(search) || (p.Description != null && p.Description.Contains(search)));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => ToDto(p))
            .ToListAsync(ct);

        return new PagedResult<ProductDto> { Total = total, Page = page, PageSize = pageSize, Items = items };
    }

    public async Task<ProductDto?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var product = await _db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && p.IsActive, ct);

        return product is null ? null : ToDto(product);
    }

    public async Task<ProductDto> CreateAsync(CreateProductDto dto, CancellationToken ct)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            Price = dto.Price,
            StockQuantity = dto.StockQuantity,
            SKU = dto.SKU,
            Category = dto.Category,
            ImageUrl = dto.ImageUrl,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);

        return ToDto(product);
    }

    public async Task<ProductDto?> UpdateAsync(Guid id, UpdateProductDto dto, CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && p.IsActive, ct);
        if (product is null) return null;

        product.Name = dto.Name;
        product.Description = dto.Description;
        product.Price = dto.Price;
        product.StockQuantity = dto.StockQuantity;
        product.SKU = dto.SKU;
        product.Category = dto.Category;
        product.ImageUrl = dto.ImageUrl;
        product.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return ToDto(product);
    }

    public async Task<ProductDto?> UpdateStockAsync(Guid id, UpdateStockDto dto, CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && p.IsActive, ct);
        if (product is null) return null;

        product.StockQuantity = dto.StockQuantity;
        product.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return ToDto(product);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && p.IsActive, ct);
        if (product is null) return false;

        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> SkuExistsAsync(string sku, Guid? excludeId, CancellationToken ct)
    {
        var query = _db.Products.Where(p => p.SKU == sku);
        if (excludeId.HasValue) query = query.Where(p => p.Id != excludeId.Value);
        return await query.AnyAsync(ct);
    }

    private static ProductDto ToDto(Product p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        Price = p.Price,
        StockQuantity = p.StockQuantity,
        SKU = p.SKU,
        Category = p.Category,
        ImageUrl = p.ImageUrl,
        IsActive = p.IsActive,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}
