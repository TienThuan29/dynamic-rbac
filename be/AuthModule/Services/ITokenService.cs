namespace AuthModule.Services;

public interface ITokenService
{
    string GenerateJwtToken(Guid userId, Guid accountId, string email, string role);

    int ExpirationSeconds { get; }
}
