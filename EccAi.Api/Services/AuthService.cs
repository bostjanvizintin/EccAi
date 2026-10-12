using EccAi.Api.Data;
using EccAi.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Services;

public class AuthService(EccAiDbContext db)
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromDays(30);

    public User? ResolveUser(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var token = header["Bearer ".Length..].Trim();
        if (token.Length == 0)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var auth = db.AuthTokens
            .Include(t => t.User)
            .FirstOrDefault(t => t.Token == token && t.ExpiresAt > now);

        return auth?.User;
    }

    public Device? ResolveDevice(HttpContext context)
    {
        var apiKey = context.Request.Headers["X-Api-Key"].ToString();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return null;
        }

        return db.Devices.FirstOrDefault(d => d.ApiKey == apiKey);
    }

    public (User User, string Token) LoginOrCreate(string email, string name)
    {
        var user = db.Users.FirstOrDefault(u => u.Email == email);
        if (user is null)
        {
            user = new User { Email = email, Name = name };
            db.Users.Add(user);
            db.SaveChanges();
        }

        var auth = new AuthToken
        {
            Token = "tok_" + Guid.NewGuid().ToString("N"),
            UserId = user.Id,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(TokenLifetime),
        };
        db.AuthTokens.Add(auth);
        db.SaveChanges();

        return (user, auth.Token);
    }

    public void Logout(string token)
    {
        var auth = db.AuthTokens.FirstOrDefault(t => t.Token == token);
        if (auth is not null)
        {
            db.AuthTokens.Remove(auth);
            db.SaveChanges();
        }
    }
}
