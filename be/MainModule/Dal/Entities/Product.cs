using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MainModule.Dal.Entities;

[Table("products")]
public class Product
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(255)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    [Column("description")]
    public string? Description { get; set; }

    [Required]
    [Column("price", TypeName = "numeric(18,2)")]
    public decimal Price { get; set; }

    [Required]
    [Column("stock_quantity")]
    public int StockQuantity { get; set; } = 0;

    [Required]
    [MaxLength(100)]
    [Column("sku")]
    public string SKU { get; set; } = string.Empty;

    [MaxLength(255)]
    [Column("category")]
    public string? Category { get; set; }

    [MaxLength(500)]
    [Column("image_url")]
    public string? ImageUrl { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
