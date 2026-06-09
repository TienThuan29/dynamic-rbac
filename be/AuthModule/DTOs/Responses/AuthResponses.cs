namespace AuthModule.DTOs.Responses;

public class LoginResponse
{
    public Guid UserId { get; set; }
    public Guid AccountId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
    public bool IsNewAccount { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
    public List<UserPermissionResponse> Permissions { get; set; } = new();
}

public class AuthenticatedUserResponse
{
    public Guid UserId { get; set; }
    public Guid AccountId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
    public bool IsNewAccount { get; set; }
}

public class UserPermissionResponse
{
    public Guid AccountId { get; set; }
    public Guid PermissionId { get; set; }
    public string? PermissionCode { get; set; }
    public string? PermissionName { get; set; }
    public string? Method { get; set; }
    public string? Endpoint { get; set; }
    public bool IsPublic { get; set; }
    public DateTime AssignedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}
