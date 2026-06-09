using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthModule.Dal.Entities;

[Table("permissions")]
public class Permission
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(20)]
    [Column("method")]
    public string? Method { get; set; }

    [MaxLength(500)]
    [Column("endpoint")]
    public string? Endpoint { get; set; }

    // Unique, admin nhập tay (auto-gen nếu được)
    [MaxLength(255)]
    [Column("permission_name")]
    public string? PermissionName { get; set; }

    // Pattern: [resource]:[action] — e.g. products:read, products:create
    [MaxLength(150)]
    [Column("permission_code")]
    public string? PermissionCode { get; set; }

    [MaxLength(1000)]
    [Column("description")]
    public string? Description { get; set; }

    [Column("is_public")]
    public bool IsPublic { get; set; } = false;

    // Quyền hệ thống — không cho phép xoá thủ công
    [Column("is_system")]
    public bool IsSystem { get; set; } = false;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("updated_by")]
    public Guid? UpdatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();
    public ICollection<TokenPermission> TokenPermissions { get; set; } = new List<TokenPermission>();
}
