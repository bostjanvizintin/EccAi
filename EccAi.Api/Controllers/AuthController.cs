using EccAi.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EccAi.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService auth) : ControllerBase
{
    public record LoginRequest(string Email, string? Name);
    public record LoginResponse(string Token, int UserId, string Email, string Name);

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Email is required." });
        }

        var (user, token) = auth.LoginOrCreate(request.Email.Trim(), request.Name?.Trim() ?? request.Email);
        return Ok(new LoginResponse(token, user.Id, user.Email, user.Name));
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var header = Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            auth.Logout(header["Bearer ".Length..].Trim());
        }
        return NoContent();
    }

    [HttpGet("me")]
    public IActionResult Me()
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }
        return Ok(new { user.Id, user.Email, user.Name });
    }
}
