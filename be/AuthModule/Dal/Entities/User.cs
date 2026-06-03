using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthModule.Dal.Entities;

[Table("users")]
public class User
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("account_id")]
    public Guid AccountId { get; set; }

    [Required]
    [MaxLength(255)]
    [Column("full_name")]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(255)]
    [EmailAddress]
    [Column("email")]
    public string? Email { get; set; }

    [MaxLength(500)]
    [Column("avatar")]
    public string? Avatar { get; set; }

    [MaxLength(20)]
    [Column("work_number")]
    public string? WorkNumber { get; set; }

    [MaxLength(100)]
    [Column("nickname")]
    public string? Nickname { get; set; }

    [MaxLength(20)]
    [Column("mobile_phone")]
    public string? MobilePhone { get; set; }

    [Column("dob")]
    public DateTime? Dob { get; set; }

    [Column("hire_date")]
    public DateTime? HireDate { get; set; }

    [MaxLength(1000)]
    [Column("description")]
    public string? Description { get; set; }

    [MaxLength(255)]
    [Column("department")]
    public string? Department { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    [ForeignKey(nameof(AccountId))]
    public Account Account { get; set; } = null!;
}
