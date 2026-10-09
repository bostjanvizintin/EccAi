using EccAi.Api.Data;
using EccAi.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Controllers;

[ApiController]
[Route("api")]
public class ErrorsController(EccAiDbContext db, AuthService auth) : ControllerBase
{
    [HttpGet("devices/{deviceId:int}/errors")]
    public IActionResult List(int deviceId, [FromQuery] int limit = 100)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var owns = db.Devices.Any(d => d.Id == deviceId && d.UserId == user.Id);
        if (!owns)
        {
            return NotFound();
        }

        limit = Math.Clamp(limit, 1, 1000);

        var errors = db.DeviceErrors
            .Where(e => e.DeviceId == deviceId)
            .OrderByDescending(e => e.Timestamp)
            .Take(limit)
            .Select(e => new { e.Id, e.Code, e.Message, e.Severity, e.Timestamp, e.Acknowledged })
            .ToList();

        return Ok(errors);
    }

    [HttpPost("errors/{id:int}/acknowledge")]
    public IActionResult Acknowledge(int id)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var error = db.DeviceErrors
            .Include(e => e.Device)
            .FirstOrDefault(e => e.Id == id && e.Device!.UserId == user.Id);

        if (error is null)
        {
            return NotFound();
        }

        error.Acknowledged = true;
        db.SaveChanges();

        return NoContent();
    }
}
