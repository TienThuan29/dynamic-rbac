using System.ComponentModel.DataAnnotations.Schema;

namespace AuthModule.Dal.Entities;

// Composite PK: (account_id, permission_id) — configured in OnModelCreating
[Table("user_permissions")]
public class UserPermission
{
    [Column("account_id")]
    public Guid AccountId { get; set; }

    [Column("permission_id")]
    public Guid PermissionId { get; set; }

    [Column("assigned_at")]
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    [Column("assigned_by")]
    public Guid? AssignedBy { get; set; }

    [Column("expires_at")]
    public DateTime? ExpiresAt { get; set; }

    // Navigation
    [ForeignKey(nameof(AccountId))]
    public Account Account { get; set; } = null!;

    [ForeignKey(nameof(PermissionId))]
    public Permission Permission { get; set; } = null!;
}
