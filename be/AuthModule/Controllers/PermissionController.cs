using AuthModule.Attributes;
using AuthModule.DTOs.Common;
using AuthModule.DTOs.Requests;
using AuthModule.DTOs.Responses;
using AuthModule.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthModule.Controllers;

[ApiController]
[Route("api/permissions")]
[Authorize]
public class PermissionController : ControllerBase
{
    private readonly IPermissionService _permissionService;
    private readonly ILogger<PermissionController> _logger;

    public PermissionController(
        IPermissionService permissionService,
        ILogger<PermissionController> logger)
    {
        _permissionService = permissionService;
        _logger = logger;
    }

    [HttpGet]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "List Permissions",
        Description = "Retrieve a paginated list of all permissions with optional filters.")]
    public async Task<ActionResult<PagedResult<PermissionResponse>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? method = null,
        [FromQuery] bool? isSystem = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] string? resource = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var result = await _permissionService.GetAllAsync(page, pageSize, search, method, isSystem, isActive, resource, ct);
        return Ok(result);
    }

    [HttpGet("resources")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "List Permission Resources",
        Description = "Retrieve the distinct resource prefixes extracted from all permission codes.")]
    public async Task<ActionResult<List<string>>> GetDistinctResources(CancellationToken ct = default)
    {
        var resources = await _permissionService.GetDistinctResourcesAsync(ct);
        return Ok(resources);
    }

    [HttpGet("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Get Permission",
        Description = "Retrieve the details of a single permission by its ID.")]
    public async Task<ActionResult<PermissionResponse>> GetById(Guid id, CancellationToken ct = default)
    {
        var result = await _permissionService.GetByIdAsync(id, ct);
        if (result == null)
            return NotFound(new { message = $"Permission {id} not found." });
        return Ok(result);
    }

    [HttpPut("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Update Permission",
        Description = "Update the name, description, code, or public flag of an existing permission.")]
    public async Task<ActionResult<PermissionResponse>> Update(
        Guid id,
        [FromBody] UpdatePermissionRequest dto,
        CancellationToken ct = default)
    {
        try
        {
            var updatedBy = GetCurrentUserId();
            var result = await _permissionService.UpdateAsync(id, dto, updatedBy, ct);
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

    [HttpDelete("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Delete Permission",
        Description = "Permanently delete a permission and its associations from the system.")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        try
        {
            var deleted = await _permissionService.DeleteAsync(id, ct);
            if (!deleted)
                return NotFound(new { message = $"Permission {id} not found." });
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("userId")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
