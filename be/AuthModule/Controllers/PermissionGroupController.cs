using AuthModule.Attributes;
using AuthModule.DTOs.Common;
using AuthModule.DTOs.Requests;
using AuthModule.DTOs.Responses;
using AuthModule.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthModule.Controllers;

[ApiController]
[Route("api/permission-groups")]
[Authorize]
public class PermissionGroupController : ControllerBase
{
    private readonly IPermissionGroupService _groupService;
    private readonly ILogger<PermissionGroupController> _logger;

    public PermissionGroupController(
        IPermissionGroupService groupService,
        ILogger<PermissionGroupController> logger)
    {
        _groupService = groupService;
        _logger = logger;
    }

    [HttpGet]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "List Permission Groups",
        Description = "Retrieve a paginated list of all permission groups.")]
    public async Task<ActionResult<PagedResult<PermissionGroupResponse>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var result = await _groupService.GetAllAsync(page, pageSize, search, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Get Permission Group",
        Description = "Retrieve the details of a single permission group by its ID, including its resolved permissions.")]
    public async Task<ActionResult<PermissionGroupResponse>> GetById(Guid id, CancellationToken ct = default)
    {
        var result = await _groupService.GetByIdAsync(id, ct);
        if (result == null)
            return NotFound(new { message = $"Permission group {id} not found." });
        return Ok(result);
    }

    [HttpPost]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Create Permission Group",
        Description = "Create a new permission group with a list of permission IDs.")]
    public async Task<ActionResult<PermissionGroupResponse>> Create(
        [FromBody] CreatePermissionGroupRequest dto,
        CancellationToken ct = default)
    {
        try
        {
            var createdBy = GetCurrentUserId();
            var result = await _groupService.CreateAsync(dto, createdBy, ct);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true,
        PermissionName = "Update Permission Group",
        Description = "Update the name, description, or permission list of an existing permission group.")]
    public async Task<ActionResult<PermissionGroupResponse>> Update(
        Guid id,
        [FromBody] UpdatePermissionGroupRequest dto,
        CancellationToken ct = default)
    {
        try
        {
            var updatedBy = GetCurrentUserId();
            var result = await _groupService.UpdateAsync(id, dto, updatedBy, ct);
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
        PermissionName = "Delete Permission Group",
        Description = "Permanently delete a permission group. Does NOT delete the permissions inside it.")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        try
        {
            var deleted = await _groupService.DeleteAsync(id, ct);
            if (!deleted)
                return NotFound(new { message = $"Permission group {id} not found." });
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
