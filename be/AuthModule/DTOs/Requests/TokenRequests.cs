namespace AuthModule.DTOs.Requests;

public class CreateTokenRequest
{
    public Guid AccountId { get; set; }
    public List<Guid> PermissionIds { get; set; } = new();
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public int? ExpiresInMinutes { get; set; }
}
