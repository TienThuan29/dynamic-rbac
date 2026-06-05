namespace AuthModule.DTOs.Requests;

public class CreateTokenRequest
{
    public Guid? AccountId { get; set; }
    public List<Guid> PermissionIds { get; set; } = new();
    public int? ExpiresInMinutes { get; set; }
}
