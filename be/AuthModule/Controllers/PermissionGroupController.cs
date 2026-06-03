using AuthModule.Attributes;
using AuthModule.DTOs;
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
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true)]
    public async Task<ActionResult<PagedResult<PermissionGroupDto>>> GetAll(
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
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true)]
    public async Task<ActionResult<PermissionGroupDto>> GetById(Guid id, CancellationToken ct = default)
    {
        var result = await _groupService.GetByIdAsync(id, ct);
        if (result == null)
            return NotFound(new { message = $"PermissionGroup {id} not found." });
        return Ok(result);
    }

    [HttpPost]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true)]
    public async Task<ActionResult<PermissionGroupDto>> Create(
        [FromBody] CreatePermissionGroupDto dto,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.GroupName))
            return BadRequest(new { message = "GroupName is required." });

        try
        {
            var createdBy = GetCurrentUserId();
            var result = await _groupService.CreateAsync(dto, createdBy, ct);
            _logger.LogInformation(
                "PermissionGroup {Id} created by {CreatedBy}.", result.Id, createdBy);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create PermissionGroup.");
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true)]
    public async Task<ActionResult<PermissionGroupDto>> Update(
        Guid id,
        [FromBody] UpdatePermissionGroupDto dto,
        CancellationToken ct = default)
    {
        try
        {
            var updatedBy = GetCurrentUserId();
            var result = await _groupService.UpdateAsync(id, dto, updatedBy, ct);
            _logger.LogInformation(
                "PermissionGroup {Id} updated by {UpdatedBy}.", id, updatedBy);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update PermissionGroup {Id}.", id);
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true)]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var deleted = await _groupService.DeleteAsync(id, ct);
        if (!deleted)
            return NotFound(new { message = $"PermissionGroup {id} not found." });

        _logger.LogInformation("PermissionGroup {Id} deleted.", id);
        return NoContent();
    }

    private Guid? GetCurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
