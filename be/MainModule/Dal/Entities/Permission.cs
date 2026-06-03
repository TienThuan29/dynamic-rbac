using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MainModule.Dal.Entities;

/// <summary>
/// Read/write access to the shared <c>permissions</c> table managed by AuthModule.
/// MainModule never runs migrations against this table — see MainDbContext.ExcludeFromMigrations().
/// </summary>
[Table("permissions")]
public class Permission
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [MaxLength(20)]
    [Column("method")]
    public string? Method { get; set; }

    [MaxLength(500)]
    [Column("endpoint")]
    public string? Endpoint { get; set; }

    [MaxLength(255)]
    [Column("permission_name")]
    public string? PermissionName { get; set; }

    [MaxLength(150)]
    [Column("permission_code")]
    public string? PermissionCode { get; set; }

    [MaxLength(1000)]
    [Column("description")]
    public string? Description { get; set; }

    [Column("is_public")]
    public bool IsPublic { get; set; }

    [Column("is_system")]
    public bool IsSystem { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; }

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("updated_by")]
    public Guid? UpdatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
