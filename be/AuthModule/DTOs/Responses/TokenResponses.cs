namespace AuthModule.DTOs.Responses;

public class TokenResponse
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string? AccountEmail { get; set; }
    public string? AccountUsername { get; set; }
    public string TokenType { get; set; } = "Bearer";
    public DateTime? ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime IssuedAt { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public List<TokenPermissionResponse> Permissions { get; set; } = new();
}

public class TokenPermissionResponse
{
    public Guid PermissionId { get; set; }
    public string? PermissionCode { get; set; }
    public string? PermissionName { get; set; }
    public string? Method { get; set; }
    public string? Endpoint { get; set; }
    public DateTime GrantedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class CreateTokenResponse
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string TokenType { get; set; } = "Bearer";
    public DateTime? ExpiresAt { get; set; }
    public DateTime IssuedAt { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string RawJwt { get; set; } = string.Empty;
    public List<Guid> Permissions { get; set; } = new();
}

public class RefreshTokenResponse
{
    public string RawJwt { get; set; } = string.Empty;
    public DateTime? ExpiresAt { get; set; }
}
