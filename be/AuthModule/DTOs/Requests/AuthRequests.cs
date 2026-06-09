namespace AuthModule.DTOs.Requests;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string EntraIdObjectId { get; set; } = string.Empty;
}
