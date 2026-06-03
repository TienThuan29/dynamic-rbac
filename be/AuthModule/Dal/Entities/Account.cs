using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthModule.Dal.Entities;

[Table("accounts")]
public class Account
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(255)]
    [Column("entra_id_object_id")]
    public string EntraIdObjectId { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    [Column("username")]
    public string Username { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [EmailAddress]
    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    [Column("role")]
    public string Role { get; set; } = "User";

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public User? User { get; set; }
    public ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();
}
