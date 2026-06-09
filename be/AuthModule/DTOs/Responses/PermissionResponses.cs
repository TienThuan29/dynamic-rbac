namespace AuthModule.DTOs.Responses;

public class PermissionResponse
{
    public Guid Id { get; set; }
    public string? Method { get; set; }
    public string? Endpoint { get; set; }
    public string? PermissionName { get; set; }
    public string? PermissionCode { get; set; }
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class PermissionGroupResponse
{
    public Guid Id { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public List<string> PermissionIds { get; set; } = new();
    public string? Description { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<PermissionResponse> Permissions { get; set; } = new();
}

public class UserPermissionDetailResponse
{
    public Guid AccountId { get; set; }
    public Guid PermissionId { get; set; }
    public string? PermissionCode { get; set; }
    public string? PermissionName { get; set; }
    public string? Method { get; set; }
    public string? Endpoint { get; set; }
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public DateTime AssignedAt { get; set; }
    public Guid? AssignedBy { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class UserAccountResponse
{
    public Guid AccountId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? FullName { get; set; }
}
