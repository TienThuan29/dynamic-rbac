using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthModule.Dal.Entities;

[Table("permission_groups")]
public class PermissionGroup
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("updated_by")]
    public Guid? UpdatedBy { get; set; }

    // group_name thay thế cho Feature trong UserPermission (cũ)
    [Required]
    [MaxLength(255)]
    [Column("group_name")]
    public string GroupName { get; set; } = string.Empty;

    // Lưu danh sách Permission Id — PostgreSQL text[]
    [Column("permission_ids")]
    public List<string> PermissionIds { get; set; } = new();

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [MaxLength(1000)]
    [Column("description")]
    public string? Description { get; set; }
}
