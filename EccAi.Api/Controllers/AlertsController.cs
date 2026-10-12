using EccAi.Api.Data;
using EccAi.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Controllers;

[ApiController]
[Route("api/alerts")]
public class AlertsController(EccAiDbContext db, AuthService auth) : ControllerBase
{
    public record AlertDto(
        int Id, int RuleId, int SensorId, string SensorName, int DeviceId, string DeviceName,
        double Value, string Message, string Severity, DateTime CreatedAt, bool Acknowledged);

    [HttpGet]
    public IActionResult List([FromQuery] bool? acknowledged, [FromQuery] int limit = 100)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        limit = Math.Clamp(limit, 1, 1000);

        var query = db.Alerts
            .Where(a => a.Rule!.UserId == user.Id)
            .Include(a => a.Rule).ThenInclude(r => r.Sensor).ThenInclude(s => s.Device)
            .AsQueryable();

        if (acknowledged is not null)
        {
            query = query.Where(a => a.Acknowledged == acknowledged);
        }

        var alerts = query
            .OrderByDescending(a => a.CreatedAt)
            .Take(limit)
            .AsEnumerable()
            .Select(ToDto)
            .ToList();

        return Ok(alerts);
    }

    [HttpPost("{id:int}/acknowledge")]
    public IActionResult Acknowledge(int id)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var alert = db.Alerts
            .Include(a => a.Rule)
            .FirstOrDefault(a => a.Id == id && a.Rule!.UserId == user.Id);
        if (alert is null)
        {
            return NotFound();
        }

        alert.Acknowledged = true;
        db.SaveChanges();

        return NoContent();
    }

    private static AlertDto ToDto(Entities.Alert a) => new(
        a.Id, a.RuleId, a.SensorId, a.Rule!.Sensor!.Name, a.DeviceId, a.Rule.Sensor.Device!.Name,
        a.Value, a.Message, a.Severity, a.CreatedAt, a.Acknowledged);
}
