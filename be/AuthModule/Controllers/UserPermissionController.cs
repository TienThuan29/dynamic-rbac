using AuthModule.Attributes;
using AuthModule.DTOs;
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
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult<PagedResult<UserAccountDto>>> GetAccounts(
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

    [HttpGet("account/{accountId:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult<List<UserPermissionDetailDto>>> GetByAccount(
        Guid accountId,
        CancellationToken ct = default)
    {
        var result = await _userPermissionService.GetByAccountIdAsync(accountId, ct);
        return Ok(result);
    }

    [HttpPost("assign")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult<List<UserPermissionDetailDto>>> Assign(
        [FromBody] AssignUserPermissionDto dto,
        CancellationToken ct = default)
    {
        if (dto.AccountId == Guid.Empty)
            return BadRequest(new { message = "AccountId is required." });
        if (dto.PermissionIds == null || dto.PermissionIds.Count == 0)
            return BadRequest(new { message = "At least one PermissionId is required." });

        var assignedBy = GetCurrentUserId() ?? Guid.Empty;
        var result = await _userPermissionService.AssignPermissionAsync(dto, assignedBy, ct);
        _logger.LogInformation(
            "Permission(s) assigned to account {AccountId} by {AssignedBy}. Total: {Count}.",
            dto.AccountId, assignedBy, result.Count);
        return Ok(result);
    }

    [HttpPost("assign-by-group")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult<List<UserPermissionDetailDto>>> AssignByGroup(
        [FromBody] AssignByGroupDto dto,
        CancellationToken ct = default)
    {
        if (dto.AccountId == Guid.Empty)
            return BadRequest(new { message = "AccountId is required." });
        if (dto.PermissionGroupId == Guid.Empty)
            return BadRequest(new { message = "PermissionGroupId is required." });

        try
        {
            var assignedBy = GetCurrentUserId() ?? Guid.Empty;
            var result = await _userPermissionService.AssignByGroupAsync(dto, assignedBy, ct);
            _logger.LogInformation(
                "PermissionGroup {GroupId} applied to account {AccountId} by {AssignedBy}. " +
                "Total permissions now: {Count}.",
                dto.PermissionGroupId, dto.AccountId, assignedBy, result.Count);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("revoke/{accountId:guid}/{permissionId:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult> Revoke(
        Guid accountId,
        Guid permissionId,
        CancellationToken ct = default)
    {
        var revoked = await _userPermissionService.RevokePermissionAsync(accountId, permissionId, ct);
        if (!revoked)
            return NotFound(new { message = "UserPermission not found." });

        _logger.LogInformation(
            "Permission {PermissionId} revoked from account {AccountId}.",
            permissionId, accountId);
        return NoContent();
    }

    [HttpDelete("revoke-group/{accountId:guid}/{permissionGroupId:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult> RevokeByGroup(
        Guid accountId,
        Guid permissionGroupId,
        CancellationToken ct = default)
    {
        var count = await _userPermissionService.RevokeAllByGroupAsync(accountId, permissionGroupId, ct);
        _logger.LogInformation(
            "{Count} permission(s) from group {GroupId} revoked from account {AccountId}.",
            count, permissionGroupId, accountId);
        return Ok(new { revokedCount = count });
    }

    private Guid? GetCurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
