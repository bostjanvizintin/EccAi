using EccAi.Api.Data;
using EccAi.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Services;

public class RuleEngine(EccAiDbContext db)
{
    public async Task<List<Alert>> EvaluateAsync(int sensorId, double value, DateTime timestamp)
    {
        var sensor = await db.Sensors
            .Include(s => s.Device)
            .FirstOrDefaultAsync(s => s.Id == sensorId);

        if (sensor is null)
        {
            return [];
        }

        var rules = await db.Rules
            .Where(r => r.SensorId == sensorId && r.Enabled)
            .ToListAsync();

        var triggered = new List<Alert>();
        foreach (var rule in rules)
        {
            if (!Matches(rule.Operator, value, rule.Threshold))
            {
                continue;
            }

            if (rule.LastTriggeredAt is not null &&
                timestamp - rule.LastTriggeredAt < TimeSpan.FromMinutes(rule.CooldownMinutes))
            {
                continue;
            }

            var alert = new Alert
            {
                RuleId = rule.Id,
                SensorId = sensorId,
                DeviceId = sensor.DeviceId,
                Value = value,
                Message = rule.Message,
                Severity = rule.Severity,
                CreatedAt = DateTime.UtcNow,
            };
            db.Alerts.Add(alert);
            rule.LastTriggeredAt = timestamp;
            triggered.Add(alert);
        }

        if (triggered.Count > 0)
        {
            await db.SaveChangesAsync();
        }

        return triggered;
    }

    private static bool Matches(string op, double value, double threshold) => op switch
    {
        "gt" => value > threshold,
        "gte" => value >= threshold,
        "lt" => value < threshold,
        "lte" => value <= threshold,
        _ => false,
    };
}
