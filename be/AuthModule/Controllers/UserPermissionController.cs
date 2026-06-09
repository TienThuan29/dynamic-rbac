using AuthModule.Attributes;
using AuthModule.DTOs.Common;
using AuthModule.DTOs.Requests;
using AuthModule.DTOs.Responses;
using AuthModule.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthModule.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UserPermissionController : ControllerBase
{
    private readonly IUserPermissionService _userPermissionService;
    private readonly ILogger<UserPermissionController> _logger;

    public UserPermissionController(
        IUserPermissionService userPermissionService,
        ILogger<UserPermissionController> logger)
    {
        _userPermissionService = userPermissionService;
        _logger = logger;
    }

    [HttpGet("accounts")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "List User Accounts",
        Description = "Retrieve a paginated list of all user accounts with optional search.")]
    public async Task<ActionResult<PagedResult<UserAccountResponse>>> GetAccounts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var result = await _userPermissionService.GetAccountsAsync(page, pageSize, search, ct);
        return Ok(result);
    }

    [HttpGet("{accountId:guid}/permissions")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "List User Permissions",
        Description = "Retrieve all direct permissions assigned to a specific account.")]
    public async Task<ActionResult<List<UserPermissionDetailResponse>>> GetByAccount(
        Guid accountId,
        CancellationToken ct = default)
    {
        var result = await _userPermissionService.GetByAccountIdAsync(accountId, ct);
        return Ok(result);
    }

    [HttpPost("permissions")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Assign User Permissions",
        Description = "Assign one or more permissions directly to an account.")]
    public async Task<ActionResult<List<UserPermissionDetailResponse>>> Assign(
        [FromBody] AssignUserPermissionRequest dto,
        CancellationToken ct = default)
    {
        try
        {
            var assignedBy = GetCurrentUserId() ?? Guid.Empty;
            var result = await _userPermissionService.AssignPermissionAsync(dto, assignedBy, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("permissions/by-group")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Assign Permissions By Group",
        Description = "Assign all permissions from a permission group to an account at once.")]
    public async Task<ActionResult<List<UserPermissionDetailResponse>>> AssignByGroup(
        [FromBody] AssignByGroupRequest dto,
        CancellationToken ct = default)
    {
        try
        {
            var assignedBy = GetCurrentUserId() ?? Guid.Empty;
            var result = await _userPermissionService.AssignByGroupAsync(dto, assignedBy, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{accountId:guid}/permissions/{permissionId:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Revoke User Permission",
        Description = "Revoke a specific permission from an account.")]
    public async Task<ActionResult> Revoke(
        Guid accountId,
        Guid permissionId,
        CancellationToken ct = default)
    {
        var revoked = await _userPermissionService.RevokePermissionAsync(accountId, permissionId, ct);
        if (!revoked)
            return NotFound(new { message = $"Permission {permissionId} not found on account {accountId}." });
        return NoContent();
    }

    [HttpDelete("{accountId:guid}/permissions/by-group/{permissionGroupId:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Revoke All Permissions By Group",
        Description = "Revoke all permissions that were assigned via a specific permission group from an account.")]
    public async Task<ActionResult> RevokeByGroup(
        Guid accountId,
        Guid permissionGroupId,
        CancellationToken ct = default)
    {
        var count = await _userPermissionService.RevokeAllByGroupAsync(accountId, permissionGroupId, ct);
        return Ok(new { message = $"{count} permission(s) revoked." });
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("userId")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
