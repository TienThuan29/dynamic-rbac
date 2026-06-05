namespace AuthModule.DTOs.Requests;

public class UpdatePermissionRequest
{
    public string? PermissionName { get; set; }
    public string? PermissionCode { get; set; }
    public string? Description { get; set; }
    public bool? IsPublic { get; set; }
    public bool? IsActive { get; set; }
}

public class CreatePermissionGroupRequest
{
    public string GroupName { get; set; } = string.Empty;
    public List<string> PermissionIds { get; set; } = new();
    public string? Description { get; set; }
}

public class UpdatePermissionGroupRequest
{
    public string? GroupName { get; set; }
    public List<string>? PermissionIds { get; set; }
    public string? Description { get; set; }
}

public class AssignUserPermissionRequest
{
    public Guid AccountId { get; set; }
    public List<Guid> PermissionIds { get; set; } = new();
    public DateTime? ExpiresAt { get; set; }
}

public class AssignByGroupRequest
{
    public Guid AccountId { get; set; }
    public Guid PermissionGroupId { get; set; }
    public DateTime? ExpiresAt { get; set; }
}
