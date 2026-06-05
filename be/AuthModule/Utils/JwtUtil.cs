using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace AuthModule.Services;

public interface ITokenService
{
    string GenerateJwtToken(Guid userId, Guid accountId, string email, string role);
    int ExpirationSeconds { get; }
}

public interface IJwtUtil : ITokenService { }


public class JwtUtil : IJwtUtil
{
      private readonly string _jwtSecret;
      private readonly string _issuer;
      private readonly string _audience;
      private readonly int _expirationMinutes;
      private readonly ILogger<JwtUtil> _logger;

      public JwtUtil(IConfiguration configuration, ILogger<JwtUtil> logger)
      {
            _jwtSecret = configuration["Jwt:Secret"]
                ?? Environment.GetEnvironmentVariable("JWT_SECRET")
                ?? throw new InvalidOperationException("JWT_SECRET not configured");

            _issuer = configuration["Jwt:Issuer"]
                ?? Environment.GetEnvironmentVariable("JWT_ISSUER")
                ?? "swovnai";

            _audience = configuration["Jwt:Audience"]
                ?? Environment.GetEnvironmentVariable("JWT_AUDIENCE")
                ?? "swovnai";

            var expirationStr = configuration["Jwt:ExpirationMinutes"]
                ?? Environment.GetEnvironmentVariable("JWT_EXPIRATION_MINUTES")
                ?? "1440";

            _expirationMinutes = int.Parse(expirationStr);
            _logger = logger;
      }

      public int ExpirationSeconds => _expirationMinutes * 60;

      public string GenerateJwtToken(Guid userId, Guid accountId, string email, string role)
      {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_jwtSecret);

            var claims = new[]
            {
            new Claim("userId", userId.ToString()),
            new Claim("accountId", accountId.ToString()),
            new Claim("email", email),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                  Subject = new ClaimsIdentity(claims),
                  Expires = DateTime.UtcNow.AddMinutes(_expirationMinutes),
                  Issuer = _issuer,
                  Audience = _audience,
                  SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            _logger.LogInformation(
                "JWT token generated for UserId: {UserId}, Email: {Email}, ExpiresIn: {ExpirationMinutes} minutes",
                userId,
                email,
                _expirationMinutes);

            return tokenString;
      }
}
