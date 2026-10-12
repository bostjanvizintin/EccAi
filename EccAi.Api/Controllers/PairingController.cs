using System.Security.Cryptography;
using EccAi.Api.Data;
using EccAi.Api.Entities;
using EccAi.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Controllers;

[ApiController]
[Route("api/pairing-codes")]
public class PairingController(EccAiDbContext db, AuthService auth) : ControllerBase
{
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(30);

    public record PairingCodeResponse(string Code, DateTime ExpiresAt);

    [HttpPost]
    public IActionResult Create()
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var code = new PairingCode
        {
            Code = GenerateCode(),
            UserId = user.Id,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.Add(CodeLifetime),
        };
        db.PairingCodes.Add(code);
        db.SaveChanges();

        return Ok(new PairingCodeResponse(code.Code, code.ExpiresAt));
    }

    [HttpGet]
    public IActionResult List()
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var codes = db.PairingCodes
            .Where(c => c.UserId == user.Id && c.DeviceId == null && c.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new { c.Code, c.CreatedAt, c.ExpiresAt })
            .ToList();

        return Ok(codes);
    }

    private static string GenerateCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var rng = RandomNumberGenerator.Create();
        var bytes = new byte[8];
        rng.GetBytes(bytes);
        return new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
    }
}
