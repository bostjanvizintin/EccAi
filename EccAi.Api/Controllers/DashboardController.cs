using EccAi.Api.Data;
using EccAi.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController(EccAiDbContext db, AuthService auth) : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var userId = user.Id;

        var devices = db.Devices
            .Where(d => d.UserId == userId)
            .Include(d => d.Sensors)
            .AsEnumerable()
            .OrderBy(d => d.Name)
            .Select(d => DevicesController.DeviceDto(d, withSensors: true))
            .ToList();

        var deviceIds = devices.Select(d => d.Id).ToList();
        var sensorIds = devices.SelectMany(d => d.Sensors).Select(s => s.Id).ToList();

        var latest = db.Measurements
            .Where(m => sensorIds.Contains(m.SensorId))
            .GroupBy(m => m.SensorId)
            .Select(g => g.OrderByDescending(m => m.Timestamp).First())
            .AsEnumerable()
            .ToDictionary(m => m.SensorId, m => new { m.Value, m.Timestamp });

        devices = [.. devices.Select(d => d with
        {
            Sensors = [.. d.Sensors.Select(s => s with
            {
                LatestValue = latest.TryGetValue(s.Id, out var m) ? m.Value : null,
                LatestTimestamp = latest.TryGetValue(s.Id, out var m2) ? m2.Timestamp : null,
            })],
        })];

        var openAlerts = db.Alerts
            .Where(a => a.Rule!.UserId == userId && !a.Acknowledged)
            .Include(a => a.Rule).ThenInclude(r => r.Sensor).ThenInclude(s => s.Device)
            .OrderByDescending(a => a.CreatedAt)
            .Take(10)
            .AsEnumerable()
            .Select(a => new
            {
                a.Id, a.Severity, a.Message, a.Value, a.CreatedAt, a.Acknowledged,
                SensorName = a.Rule!.Sensor!.Name,
                DeviceName = a.Rule.Sensor.Device!.Name,
            })
            .ToList();

        var openAlertCount = db.Alerts.Count(a => a.Rule!.UserId == userId && !a.Acknowledged);
        var unackedErrorCount = db.DeviceErrors.Count(e => e.Device!.UserId == userId && !e.Acknowledged);

        return Ok(new
        {
            DeviceCount = devices.Count,
            OnlineCount = devices.Count(d => d.IsOnline),
            SensorCount = devices.Sum(d => d.Sensors.Count),
            OpenAlertCount = openAlertCount,
            UnacknowledgedErrorCount = unackedErrorCount,
            Devices = devices,
            OpenAlerts = openAlerts,
        });
    }
}
