using MainModule.Attributes;
using MainModule.DTOs;
using MainModule.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MainModule.Controllers;

[ApiController]
[Route("api/products")]
[AllowAnonymous]
[PermissionMeta(Public = PublicMode.Public, IsSystem = false, AutoGenerateCode = true)]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;

    public ProductsController(IProductService productService) => _productService = productService;

    // GET api/products?page=1&pageSize=20&category=electronics&search=phone
    [HttpGet]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = false, AutoGenerateCode = true,
        PermissionName = "Danh sách sản phẩm",
        Description = "Lấy danh sách sản phẩm (phân trang, lọc theo category và tìm kiếm)")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? category = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        var result = await _productService.GetAllAsync(page, pageSize, category, search, ct);
        return Ok(result);
    }

    // GET api/products/{id}
    [HttpGet("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = false, AutoGenerateCode = true,
        PermissionName = "Chi tiết sản phẩm",
        Description = "Lấy thông tin chi tiết của một sản phẩm theo ID")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var product = await _productService.GetByIdAsync(id, ct);
        return product is null ? NotFound(new { message = "Product not found" }) : Ok(product);
    }

    // POST api/products
    [HttpPost]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = false, AutoGenerateCode = true,
        PermissionName = "Tạo sản phẩm",
        Description = "Tạo mới một sản phẩm (SKU không được trùng)")]
    public async Task<IActionResult> Create([FromBody] CreateProductDto dto, CancellationToken ct)
    {
        if (await _productService.SkuExistsAsync(dto.SKU, excludeId: null, ct))
            return Conflict(new { message = $"SKU '{dto.SKU}' already exists" });

        var created = await _productService.CreateAsync(dto, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    // PUT api/products/{id}
    [HttpPut("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = false, AutoGenerateCode = true,
        PermissionName = "Cập nhật sản phẩm",
        Description = "Cập nhật toàn bộ thông tin sản phẩm theo ID")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductDto dto, CancellationToken ct)
    {
        if (await _productService.SkuExistsAsync(dto.SKU, excludeId: id, ct))
            return Conflict(new { message = $"SKU '{dto.SKU}' already exists" });

        var updated = await _productService.UpdateAsync(id, dto, ct);
        return updated is null ? NotFound(new { message = "Product not found" }) : Ok(updated);
    }

    // PATCH api/products/{id}/stock
    [HttpPatch("{id:guid}/stock")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = false, AutoGenerateCode = true,
        PermissionName = "Cập nhật tồn kho",
        Description = "Cập nhật số lượng tồn kho của sản phẩm theo ID")]
    public async Task<IActionResult> UpdateStock(Guid id, [FromBody] UpdateStockDto dto, CancellationToken ct)
    {
        var updated = await _productService.UpdateStockAsync(id, dto, ct);
        return updated is null ? NotFound(new { message = "Product not found" }) : Ok(updated);
    }

    // DELETE api/products/{id}  (soft delete)
    [HttpDelete("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = false, AutoGenerateCode = true,
        PermissionName = "Xóa sản phẩm",
        Description = "Xóa mềm một sản phẩm theo ID")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _productService.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound(new { message = "Product not found" });
    }
}

