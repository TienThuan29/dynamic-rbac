using MainModule.DTOs;

namespace MainModule.Services;

public interface IProductService
{
    Task<PagedResult<ProductDto>> GetAllAsync(int page, int pageSize, string? category, string? search, CancellationToken ct);
    Task<ProductDto?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ProductDto> CreateAsync(CreateProductDto dto, CancellationToken ct);
    Task<ProductDto?> UpdateAsync(Guid id, UpdateProductDto dto, CancellationToken ct);
    Task<ProductDto?> UpdateStockAsync(Guid id, UpdateStockDto dto, CancellationToken ct);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct);
    Task<bool> SkuExistsAsync(string sku, Guid? excludeId, CancellationToken ct);
}
