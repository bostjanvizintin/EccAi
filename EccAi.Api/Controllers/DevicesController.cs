using EccAi.Api.Data;
using EccAi.Api.Entities;
using EccAi.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Controllers;

[ApiController]
[Route("api/devices")]
public class DevicesController(EccAiDbContext db, AuthService auth) : ControllerBase
{
    [HttpGet]
    public IActionResult List()
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var devices = db.Devices
            .Where(d => d.UserId == user.Id)
            .Include(d => d.Sensors)
            .OrderBy(d => d.Name)
            .AsEnumerable()
            .Select(d => DeviceDto(d, withSensors: true))
            .ToList();

        return Ok(devices);
    }

    [HttpGet("{id:int}")]
    public IActionResult Get(int id)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var device = db.Devices
            .Include(d => d.Sensors)
            .FirstOrDefault(d => d.Id == id && d.UserId == user.Id);

        if (device is null)
        {
            return NotFound();
        }

        var latest = db.Measurements
            .Where(m => m.Sensor!.DeviceId == id)
            .GroupBy(m => m.SensorId)
            .Select(g => g.OrderByDescending(m => m.Timestamp).First())
            .AsEnumerable()
            .ToDictionary(m => m.SensorId, m => new { m.Value, m.Timestamp });

        var dto = DeviceDto(device, withSensors: true);
        var withLatest = dto with
        {
            Sensors = dto.Sensors.Select(s => s with
            {
                LatestValue = latest.TryGetValue(s.Id, out var m) ? m.Value : null,
                LatestTimestamp = latest.TryGetValue(s.Id, out var m2) ? m2.Timestamp : null,
            }).ToList(),
        };

        return Ok(withLatest);
    }

    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var device = db.Devices
            .Include(d => d.Sensors).ThenInclude(s => s.Measurements)
            .Include(d => d.Errors)
            .FirstOrDefault(d => d.Id == id && d.UserId == user.Id);

        if (device is null)
        {
            return NotFound();
        }

        var sensorIds = device.Sensors.Select(s => s.Id).ToList();
        db.Measurements.RemoveRange(db.Measurements.Where(m => sensorIds.Contains(m.SensorId)));
        db.Rules.RemoveRange(db.Rules.Where(r => sensorIds.Contains(r.SensorId)));
        db.Alerts.RemoveRange(db.Alerts.Where(a => a.DeviceId == id));
        db.Sensors.RemoveRange(device.Sensors);
        db.DeviceErrors.RemoveRange(device.Errors);
        db.Devices.Remove(device);
        db.SaveChanges();

        return NoContent();
    }

    internal static DeviceDto DeviceDto(Device d, bool withSensors) => new(
        d.Id,
        d.Name,
        d.HardwareId,
        d.PairedAt,
        d.LastSeenAt,
        d.LastSeenAt is not null && DateTime.UtcNow - d.LastSeenAt < TimeSpan.FromMinutes(5),
        withSensors ? [.. d.Sensors.OrderBy(s => s.Key).Select(s => SensorDto(s))] : []
    );

    internal static SensorDto SensorDto(Sensor s) =>
        new(s.Id, s.DeviceId, s.Key, s.Name, s.Unit, s.MaxExpected, s.CreatedAt, null, null);
}

public record DeviceDto(
    int Id,
    string Name,
    string HardwareId,
    DateTime PairedAt,
    DateTime? LastSeenAt,
    bool IsOnline,
    List<SensorDto> Sensors);

public record SensorDto(
    int Id,
    int DeviceId,
    string Key,
    string Name,
    string Unit,
    double? MaxExpected,
    DateTime CreatedAt,
    double? LatestValue,
    DateTime? LatestTimestamp);
