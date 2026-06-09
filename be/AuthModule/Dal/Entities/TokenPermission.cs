using System.ComponentModel.DataAnnotations.Schema;

namespace AuthModule.Dal.Entities;

[Table("token_permissions")]
public class TokenPermission
{
    [Column("token_id")]
    public Guid TokenId { get; set; }

    [Column("permission_id")]
    public Guid PermissionId { get; set; }

    [Column("granted_at")]
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

    [Column("expires_at")]
    public DateTime? ExpiresAt { get; set; }

    // Navigation
    [ForeignKey(nameof(TokenId))]
    public Token Token { get; set; } = null!;

    [ForeignKey(nameof(PermissionId))]
    public Permission Permission { get; set; } = null!;
}
