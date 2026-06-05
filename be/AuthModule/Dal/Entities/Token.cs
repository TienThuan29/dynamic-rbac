using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthModule.Dal.Entities;

[Table("tokens")]
public class Token
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("created_by")]
    public Guid CreatedBy { get; set; }

    [Column("account_id")]
    public Guid? AccountId { get; set; }

    [Required]
    [MaxLength(255)]
    [Column("token_hash")]
    public string TokenHash { get; set; } = string.Empty;

    [MaxLength(50)]
    [Column("token_type")]
    public string TokenType { get; set; } = "Bearer";

    [Column("expires_at")]
    public DateTime? ExpiresAt { get; set; }

    [Column("is_revoked")]
    public bool IsRevoked { get; set; } = false;

    // Navigation
    [ForeignKey(nameof(CreatedBy))]
    public Account CreatedByAccount { get; set; } = null!;

    [ForeignKey(nameof(AccountId))]
    public Account? Account { get; set; }

    public ICollection<TokenPermission> TokenPermissions { get; set; } = new List<TokenPermission>();
}
