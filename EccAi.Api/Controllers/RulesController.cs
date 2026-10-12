using EccAi.Api.Data;
using EccAi.Api.Entities;
using EccAi.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Controllers;

[ApiController]
[Route("api/rules")]
public class RulesController(EccAiDbContext db, AuthService auth) : ControllerBase
{
    private static readonly string[] Operators = ["gt", "gte", "lt", "lte"];
    private static readonly string[] Severities = ["info", "warning", "critical"];

    public record SaveRuleRequest(int SensorId, string Operator, double Threshold, string Severity, string Message, bool Enabled, int CooldownMinutes);
    public record RuleDto(
        int Id, int SensorId, string SensorName, string SensorUnit, int DeviceId, string DeviceName,
        string Operator, double Threshold, string Severity, string Message, bool Enabled, int CooldownMinutes, DateTime? LastTriggeredAt);

    [HttpGet]
    public IActionResult List()
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var rules = db.Rules
            .Where(r => r.UserId == user.Id)
            .Include(r => r.Sensor).ThenInclude(s => s.Device)
            .AsEnumerable()
            .OrderBy(r => r.Sensor!.Device!.Name).ThenBy(r => r.Sensor!.Name)
            .Select(ToDto)
            .ToList();

        return Ok(rules);
    }

    [HttpPost]
    public IActionResult Create([FromBody] SaveRuleRequest request)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var sensor = db.Sensors.Include(s => s.Device)
            .FirstOrDefault(s => s.Id == request.SensorId && s.Device!.UserId == user.Id);
        if (sensor is null)
        {
            return BadRequest(new { message = "Unknown sensor." });
        }

        var error = Validate(request);
        if (error is not null)
        {
            return BadRequest(new { message = error });
        }

        var rule = new Rule
        {
            UserId = user.Id,
            SensorId = request.SensorId,
            Operator = request.Operator,
            Threshold = request.Threshold,
            Severity = request.Severity,
            Message = request.Message.Trim(),
            Enabled = request.Enabled,
            CooldownMinutes = Math.Clamp(request.CooldownMinutes, 0, 24 * 60),
        };
        db.Rules.Add(rule);
        db.SaveChanges();

        return Ok(ToDto(rule));
    }

    [HttpPut("{id:int}")]
    public IActionResult Update(int id, [FromBody] SaveRuleRequest request)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var rule = db.Rules
            .Include(r => r.Sensor).ThenInclude(s => s.Device)
            .FirstOrDefault(r => r.Id == id && r.UserId == user.Id);
        if (rule is null)
        {
            return NotFound();
        }

        if (request.SensorId != rule.SensorId)
        {
            var sensor = db.Sensors.Include(s => s.Device)
                .FirstOrDefault(s => s.Id == request.SensorId && s.Device!.UserId == user.Id);
            if (sensor is null)
            {
                return BadRequest(new { message = "Unknown sensor." });
            }
        }

        var error = Validate(request);
        if (error is not null)
        {
            return BadRequest(new { message = error });
        }

        rule.SensorId = request.SensorId;
        rule.Operator = request.Operator;
        rule.Threshold = request.Threshold;
        rule.Severity = request.Severity;
        rule.Message = request.Message.Trim();
        rule.Enabled = request.Enabled;
        rule.CooldownMinutes = Math.Clamp(request.CooldownMinutes, 0, 24 * 60);
        db.SaveChanges();

        return Ok(ToDto(rule));
    }

    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        var user = auth.ResolveUser(HttpContext);
        if (user is null)
        {
            return Unauthorized();
        }

        var rule = db.Rules.FirstOrDefault(r => r.Id == id && r.UserId == user.Id);
        if (rule is null)
        {
            return NotFound();
        }

        db.Rules.Remove(rule);
        db.SaveChanges();

        return NoContent();
    }

    private static string? Validate(SaveRuleRequest request)
    {
        if (!Operators.Contains(request.Operator))
        {
            return "Operator must be one of: gt, gte, lt, lte.";
        }
        if (!Severities.Contains(request.Severity))
        {
            return "Severity must be one of: info, warning, critical.";
        }
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return "Message is required.";
        }
        return null;
    }

    private static RuleDto ToDto(Rule r) => new(
        r.Id, r.SensorId, r.Sensor!.Name, r.Sensor.Unit, r.Sensor.DeviceId, r.Sensor.Device!.Name,
        r.Operator, r.Threshold, r.Severity, r.Message, r.Enabled, r.CooldownMinutes, r.LastTriggeredAt);
}
