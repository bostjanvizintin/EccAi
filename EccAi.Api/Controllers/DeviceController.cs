using EccAi.Api.Data;
using EccAi.Api.Entities;
using EccAi.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Controllers;

[ApiController]
[Route("api/device")]
public class DeviceController(EccAiDbContext db, AuthService auth, RuleEngine ruleEngine) : ControllerBase
{
    public record PairRequest(string Code, string HardwareId, string Name);
    public record Reading(string Key, double Value, DateTimeOffset Timestamp);
    public record IngestRequest(List<Reading> Readings);
    public record ErrorReport(string Code, string Message, string Severity, DateTimeOffset? Timestamp);

    [HttpPost("pair")]
    public IActionResult Pair([FromBody] PairRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code) ||
            string.IsNullOrWhiteSpace(request.HardwareId) ||
            string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Code, hardwareId and name are required." });
        }

        var pairing = db.PairingCodes
            .FirstOrDefault(p => p.Code == request.Code.Trim().ToUpperInvariant());

        if (pairing is null || pairing.ExpiresAt < DateTime.UtcNow || pairing.DeviceId is not null)
        {
            return BadRequest(new { message = "Invalid or expired pairing code." });
        }

        var existing = db.Devices.FirstOrDefault(d => d.HardwareId == request.HardwareId);
        if (existing is not null)
        {
            if (existing.UserId != pairing.UserId)
            {
                return Conflict(new { message = "This hardware is already paired to another account." });
            }

            pairing.DeviceId = existing.Id;
            db.SaveChanges();
            return Ok(new { existing.Id, existing.ApiKey, existing.Name, Sensors = existing.Sensors.Count });
        }

        var device = new Device
        {
            UserId = pairing.UserId,
            Name = request.Name.Trim(),
            HardwareId = request.HardwareId.Trim(),
            ApiKey = "dev_" + Guid.NewGuid().ToString("N"),
            PairedAt = DateTime.UtcNow,
            LastSeenAt = DateTime.UtcNow,
        };
        db.Devices.Add(device);
        pairing.DeviceId = device.Id;
        db.SaveChanges();

        return Ok(new { device.Id, device.ApiKey, device.Name, Sensors = 0 });
    }

    [HttpGet("config")]
    public IActionResult Config()
    {
        var device = auth.ResolveDevice(HttpContext);
        if (device is null)
        {
            return Unauthorized();
        }

        var sensors = db.Sensors
            .Where(s => s.DeviceId == device.Id)
            .OrderBy(s => s.Key)
            .Select(s => new { s.Id, s.Key, s.Name, s.Unit, s.MaxExpected })
            .ToList();

        device.LastSeenAt = DateTime.UtcNow;
        db.SaveChanges();

        return Ok(new { device.Name, device.HardwareId, Sensors = sensors });
    }

    [HttpPost("measurements")]
    public async Task<IActionResult> Measurements([FromBody] IngestRequest request)
    {
        var device = auth.ResolveDevice(HttpContext);
        if (device is null)
        {
            return Unauthorized();
        }

        if (request.Readings is null || request.Readings.Count == 0)
        {
            return BadRequest(new { message = "No readings supplied." });
        }

        var sensors = db.Sensors.Where(s => s.DeviceId == device.Id).ToList();
        var byKey = sensors.ToDictionary(s => s.Key, StringComparer.OrdinalIgnoreCase);

        var now = DateTime.UtcNow;
        var accepted = 0;
        var newAlerts = new List<object>();

        foreach (var reading in request.Readings)
        {
            if (!byKey.TryGetValue(reading.Key, out var sensor))
            {
                continue;
            }

            var timestamp = reading.Timestamp == default ? now : reading.Timestamp.UtcDateTime;
            db.Measurements.Add(new Measurement
            {
                SensorId = sensor.Id,
                Value = reading.Value,
                Timestamp = timestamp,
                ReceivedAt = now,
            });
            accepted++;

            var alerts = await ruleEngine.EvaluateAsync(sensor.Id, reading.Value, timestamp);
            newAlerts.AddRange(alerts.Select(a => new { a.Id, a.Severity, a.Message, a.Value, Sensor = sensor.Name }));
        }

        device.LastSeenAt = now;
        db.SaveChanges();

        return Ok(new { Accepted = accepted, Alerts = newAlerts });
    }

    [HttpPost("errors")]
    public IActionResult Errors([FromBody] ErrorReport report)
    {
        var device = auth.ResolveDevice(HttpContext);
        if (device is null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(report.Code) || string.IsNullOrWhiteSpace(report.Message))
        {
            return BadRequest(new { message = "Code and message are required." });
        }

        var severity = report.Severity?.ToLowerInvariant() switch
        {
            "critical" or "error" => "error",
            "warning" => "warning",
            _ => "info",
        };

        db.DeviceErrors.Add(new DeviceError
        {
            DeviceId = device.Id,
            Code = report.Code.Trim(),
            Message = report.Message.Trim(),
            Severity = severity,
            Timestamp = report.Timestamp?.UtcDateTime ?? DateTime.UtcNow,
            ReceivedAt = DateTime.UtcNow,
        });
        device.LastSeenAt = DateTime.UtcNow;
        db.SaveChanges();

        return Accepted();
    }
}
