using EccAi.Api.Data;
using EccAi.Api.Entities;
using EccAi.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Controllers;

[ApiController]
[Route("api")]
public class SensorsController(EccAiDbContext db, AuthService auth) : ControllerBase
{
    public record CreateSensorRequest(string Key, string Name, string? Unit, double? MaxExpected);
    public record UpdateSensorRequest(string Name, string? Unit, double? MaxExpected);

    [HttpPost("devices/{deviceId:int}/sensors")]
    public IActionResult Create(int deviceId, [FromBody] CreateSensorRequest request)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var device = db.Devices.Include(d => d.Sensors)
            .FirstOrDefault(d => d.Id == deviceId && d.UserId == user.Id);
        if (device is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Key) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Key and name are required." });
        }

        var key = request.Key.Trim().ToLowerInvariant();
        if (device.Sensors.Any(s => s.Key == key))
        {
            return Conflict(new { message = $"Sensor channel '{key}' already exists on this device." });
        }

        var sensor = new Sensor
        {
            DeviceId = deviceId,
            Key = key,
            Name = request.Name.Trim(),
            Unit = string.IsNullOrWhiteSpace(request.Unit) ? "A" : request.Unit.Trim(),
            MaxExpected = request.MaxExpected,
            CreatedAt = DateTime.UtcNow,
        };
        db.Sensors.Add(sensor);
        db.SaveChanges();

        return CreatedAtAction(nameof(Get), new { id = sensor.Id }, DevicesController.SensorDto(sensor));
    }

    [HttpGet("sensors/{id:int}")]
    public IActionResult Get(int id)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var sensor = db.Sensors
            .Include(s => s.Device)
            .FirstOrDefault(s => s.Id == id && s.Device!.UserId == user.Id);

        if (sensor is null)
        {
            return NotFound();
        }

        return Ok(DevicesController.SensorDto(sensor));
    }

    [HttpPut("sensors/{id:int}")]
    public IActionResult Update(int id, [FromBody] UpdateSensorRequest request)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var sensor = db.Sensors
            .Include(s => s.Device)
            .FirstOrDefault(s => s.Id == id && s.Device!.UserId == user.Id);

        if (sensor is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        sensor.Name = request.Name.Trim();
        if (!string.IsNullOrWhiteSpace(request.Unit))
        {
            sensor.Unit = request.Unit.Trim();
        }
        sensor.MaxExpected = request.MaxExpected;
        db.SaveChanges();

        return Ok(DevicesController.SensorDto(sensor));
    }

    [HttpDelete("sensors/{id:int}")]
    public IActionResult Delete(int id)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var sensor = db.Sensors
            .Include(s => s.Device)
            .FirstOrDefault(s => s.Id == id && s.Device!.UserId == user.Id);

        if (sensor is null)
        {
            return NotFound();
        }

        db.Measurements.RemoveRange(db.Measurements.Where(m => m.SensorId == id));
        db.Rules.RemoveRange(db.Rules.Where(r => r.SensorId == id));
        db.Sensors.Remove(sensor);
        db.SaveChanges();

        return NoContent();
    }

    [HttpGet("sensors/{id:int}/measurements")]
    public IActionResult Measurements(int id, [FromQuery] int limit = 200, [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var sensor = db.Sensors.Include(s => s.Device)
            .FirstOrDefault(s => s.Id == id && s.Device!.UserId == user.Id);
        if (sensor is null)
        {
            return NotFound();
        }

        limit = Math.Clamp(limit, 1, 5000);

        var query = db.Measurements.Where(m => m.SensorId == id);
        if (from is not null)
        {
            query = query.Where(m => m.Timestamp >= from);
        }
        if (to is not null)
        {
            query = query.Where(m => m.Timestamp <= to);
        }

        var points = query
            .OrderByDescending(m => m.Timestamp)
            .Take(limit)
            .AsEnumerable()
            .OrderBy(m => m.Timestamp)
            .Select(m => new { m.Value, m.Timestamp })
            .ToList();

        return Ok(points);
    }
}
