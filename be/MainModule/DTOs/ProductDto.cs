using System.ComponentModel.DataAnnotations;

namespace MainModule.DTOs;

public class PagedResult<T>
{
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<T> Items { get; set; } = [];
}

public class ProductDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int StockQuantity { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateProductDto
{
    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    [Range(0, double.MaxValue)]
    public decimal Price { get; set; }

    [Range(0, int.MaxValue)]
    public int StockQuantity { get; set; } = 0;

    [Required]
    [MaxLength(100)]
    public string SKU { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Category { get; set; }

    [MaxLength(500)]
    public string? ImageUrl { get; set; }
}

public class UpdateProductDto
{
    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    [Range(0, double.MaxValue)]
    public decimal Price { get; set; }

    [Range(0, int.MaxValue)]
    public int StockQuantity { get; set; }

    [Required]
    [MaxLength(100)]
    public string SKU { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Category { get; set; }

    [MaxLength(500)]
    public string? ImageUrl { get; set; }
}

public class UpdateStockDto
{
    [Range(0, int.MaxValue)]
    public int StockQuantity { get; set; }
}
