namespace AuthModule.DTOs;

// ========== Permission DTOs ==========

public class PermissionDto
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

public class UpdatePermissionDto
{
    public string? PermissionName { get; set; }
    public string? PermissionCode { get; set; }
    public string? Description { get; set; }
    public bool? IsPublic { get; set; }
    public bool? IsActive { get; set; }
}

// ========== PermissionGroup DTOs ==========

public class PermissionGroupDto
{
    public Guid Id { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public List<string> PermissionIds { get; set; } = new();
    public string? Description { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Resolved permissions (read-only summary)
    public List<PermissionDto> Permissions { get; set; } = new();
}

public class CreatePermissionGroupDto
{
    public string GroupName { get; set; } = string.Empty;
    public List<string> PermissionIds { get; set; } = new();
    public string? Description { get; set; }
}

public class UpdatePermissionGroupDto
{
    public string? GroupName { get; set; }
    public List<string>? PermissionIds { get; set; }
    public string? Description { get; set; }
}

// ========== UserPermission DTOs ==========

public class UserPermissionDetailDto
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

public class AssignUserPermissionDto
{
    public Guid AccountId { get; set; }
    public List<Guid> PermissionIds { get; set; } = new();
    public DateTime? ExpiresAt { get; set; }
}

public class AssignByGroupDto
{
    public Guid AccountId { get; set; }
    public Guid PermissionGroupId { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class UserAccountDto
{
    public Guid AccountId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? FullName { get; set; }
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;
}
