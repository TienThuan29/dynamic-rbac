using AuthModule.Attributes;
using AuthModule.DTOs.Common;
using AuthModule.DTOs.Requests;
using AuthModule.DTOs.Responses;
using AuthModule.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AuthModule.Controllers;

[ApiController]
[Route("api/tokens")]
[Authorize]
public class TokenController : ControllerBase
{
    private readonly ITokenAppService _tokenService;

    public TokenController(ITokenAppService tokenService)
    {
        _tokenService = tokenService;
    }

    [HttpGet]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "List Tokens",
        Description = "Retrieve a paginated list of tokens for the current account, or all tokens if Admin.")]
    public async Task<ActionResult<PagedResult<TokenResponse>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool? isRevoked = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var (accountId, isAdmin) = GetAuthContext();
        var result = await _tokenService.GetAllAsync(accountId, isAdmin, page, pageSize, isRevoked, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Get Token",
        Description = "Retrieve the details of a single token by its ID.")]
    public async Task<ActionResult<TokenResponse>> GetById(Guid id, CancellationToken ct = default)
    {
        try
        {
            var (accountId, isAdmin) = GetAuthContext();
            var result = await _tokenService.GetByIdAsync(id, accountId, isAdmin, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Create Token",
        Description = "Create a new long-lived token for an account with optional permissions.")]
    public async Task<ActionResult<CreateTokenResponse>> Create(
        [FromBody] CreateTokenRequest dto,
        CancellationToken ct = default)
    {
        try
        {
            var (accountId, isAdmin) = GetAuthContext();
            if (!accountId.HasValue)
                return Unauthorized(new { message = "Invalid session." });

            var result = await _tokenService.CreateAsync(accountId.Value, dto, ct);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/refresh")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Refresh Token",
        Description = "Rotate a token's hash and optionally extend its expiration. Returns the new raw token value (only shown once).")]
    public async Task<ActionResult<RefreshTokenResponse>> Refresh(
        Guid id,
        [FromQuery] int? extendMinutes = null,
        CancellationToken ct = default)
    {
        try
        {
            var (accountId, isAdmin) = GetAuthContext();
            var result = await _tokenService.RefreshAsync(id, accountId, isAdmin, extendMinutes, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
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

    [HttpPost("{id:guid}/revoke")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Revoke Token",
        Description = "Revoke a single token by its ID.")]
    public async Task<ActionResult> Revoke(Guid id, CancellationToken ct = default)
    {
        try
        {
            var (accountId, isAdmin) = GetAuthContext();
            await _tokenService.RevokeAsync(id, accountId, isAdmin, ct);
            return Ok(new { message = "Token revoked successfully." });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
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

    [HttpDelete("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Delete Token",
        Description = "Permanently delete a revoked token and its associated permissions.")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        try
        {
            var (accountId, isAdmin) = GetAuthContext();
            await _tokenService.DeleteAsync(id, accountId, isAdmin, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
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

    [HttpPost("{id:guid}/permissions")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Add Token Permissions",
        Description = "Grant one or more permissions to an existing token.")]
    public async Task<ActionResult<TokenResponse>> AddPermissions(
        Guid id,
        [FromBody] List<Guid> permissionIds,
        CancellationToken ct = default)
    {
        try
        {
            var (accountId, isAdmin) = GetAuthContext();
            var result = await _tokenService.AddPermissionsAsync(id, permissionIds, accountId, isAdmin, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
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

    [HttpDelete("{id:guid}/permissions/{permissionId:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Remove Token Permission",
        Description = "Remove a specific permission from a token.")]
    public async Task<ActionResult> RemovePermission(
        Guid id,
        Guid permissionId,
        CancellationToken ct = default)
    {
        try
        {
            var (accountId, isAdmin) = GetAuthContext();
            await _tokenService.RemovePermissionAsync(id, permissionId, accountId, isAdmin, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    private (Guid? AccountId, bool IsAdmin) GetAuthContext()
    {
        var accountIdClaim = User.FindFirst("accountId")?.Value;
        var accountId = Guid.TryParse(accountIdClaim, out var id) ? id : (Guid?)null;
        var isAdmin = User.FindFirst(ClaimTypes.Role)?.Value?.Equals("Admin", StringComparison.OrdinalIgnoreCase) ?? false;
        return (accountId, isAdmin);
    }
}
