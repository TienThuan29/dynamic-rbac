using AuthModule.Attributes;
using AuthModule.DTOs;
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
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult<PagedResult<PermissionDto>>> GetAll(
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
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult<List<string>>> GetDistinctResources(CancellationToken ct = default)
    {
        var resources = await _permissionService.GetDistinctResourcesAsync(ct);
        return Ok(resources);
    }

    [HttpGet("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult<PermissionDto>> GetById(Guid id, CancellationToken ct = default)
    {
        var result = await _permissionService.GetByIdAsync(id, ct);
        if (result == null)
            return NotFound(new { message = $"Permission {id} not found." });
        return Ok(result);
    }

    [HttpPut("{id:guid}")]
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult<PermissionDto>> Update(
        Guid id,
        [FromBody] UpdatePermissionDto dto,
        CancellationToken ct = default)
    {
        try
        {
            var updatedBy = GetCurrentUserId();
            var result = await _permissionService.UpdateAsync(id, dto, updatedBy, ct);
            _logger.LogInformation(
                "Permission {Id} updated by {UpdatedBy}.", id, updatedBy);
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
    [PermissionMeta(Public = PublicMode.Private, IsSystem = true, AutoGenerateCode = true)]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        try
        {
            var deleted = await _permissionService.DeleteAsync(id, ct);
            if (!deleted)
                return NotFound(new { message = $"Permission {id} not found." });
            _logger.LogInformation("Permission {Id} deleted.", id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private Guid? GetCurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
