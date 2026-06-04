using AuthModule.Attributes;
using AuthModule.DTOs;
using AuthModule.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthModule.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ITokenService _tokenService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        ITokenService tokenService,
        ILogger<AuthController> logger)
    {
        _authService = authService;
        _tokenService = tokenService;
        _logger = logger;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [PermissionMeta(Public = PublicMode.Public, IsSystem = true,
        PermissionName = "Login",
        Description = "Authenticate via Microsoft Entra ID and receive a JWT access token with the account's assigned permissions.")]
    public async Task<ActionResult<LoginResponseDto>> Login(
        [FromBody] LoginDto loginDto,
        CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(loginDto.Email) ||
                string.IsNullOrWhiteSpace(loginDto.EntraIdObjectId))
            {
                return BadRequest(new { message = "Email và EntraIdObjectId không được để trống" });
            }

            var userAccount = await _authService.LoginOrCreateUserAsync(loginDto, cancellationToken);

            var accessToken = _tokenService.GenerateJwtToken(
                userAccount.UserId,
                userAccount.AccountId,
                userAccount.Email,
                userAccount.Role);

            var permissions = await _authService.GetPermissionsAsync(
                userAccount.AccountId,
                cancellationToken);

            var response = new LoginResponseDto
            {
                UserId = userAccount.UserId,
                AccountId = userAccount.AccountId,
                Email = userAccount.Email,
                FullName = userAccount.FullName,
                Role = userAccount.Role,
                IsNewAccount = userAccount.IsNewAccount,
                AccessToken = accessToken,
                ExpiresIn = _tokenService.ExpirationSeconds,
                Permissions = permissions
            };

            _logger.LogInformation(
                "User login successful. UserId: {UserId}, Email: {Email}, IsNewAccount: {IsNewAccount}",
                response.UserId,
                response.Email,
                response.IsNewAccount);

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi trong quá trình login");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "Lỗi trong quá trình đăng nhập", error = ex.Message });
        }
    }
}
