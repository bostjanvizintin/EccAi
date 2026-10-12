using EccAi.Api.Entities;

namespace EccAi.Api.Data;

public static class SeedData
{
    public static void Seed(EccAiDbContext db)
    {
        if (db.Users.Any())
        {
            return;
        }

        var now = DateTime.UtcNow;

        var user = new User { Email = "demo@eccai.local", Name = "Demo User" };
        db.Users.Add(user);
        db.SaveChanges();

        var device = new Device
        {
            User = user,
            Name = "Workshop Panel",
            HardwareId = "ESP32-A1B2C3",
            ApiKey = "dev_" + Guid.NewGuid().ToString("N"),
            PairedAt = now.AddDays(-14),
            LastSeenAt = now.AddMinutes(-2),
        };

        var mainLine = new Sensor
        {
            Device = device,
            Key = "ch1",
            Name = "Main Line",
            Unit = "A",
            MaxExpected = 30,
            CreatedAt = now.AddDays(-14),
        };
        var hvac = new Sensor
        {
            Device = device,
            Key = "ch2",
            Name = "HVAC Circuit",
            Unit = "A",
            MaxExpected = 15,
            CreatedAt = now.AddDays(-14),
        };
        var workshop = new Sensor
        {
            Device = device,
            Key = "ch3",
            Name = "Workshop Outlet",
            Unit = "A",
            MaxExpected = 10,
            CreatedAt = now.AddDays(-14),
        };

        device.Sensors.AddRange([mainLine, hvac, workshop]);
        db.Devices.Add(device);
        db.SaveChanges();

        var rng = new Random(42);
        for (var i = 36; i >= 0; i--)
        {
            var t = now.AddMinutes(-i * 10);
            AddMeasurement(db, mainLine, 12 + Math.Sin(i / 3.0) * 4 + rng.NextDouble() * 1.5, t);
            AddMeasurement(db, hvac, 6 + (i % 6 == 0 ? 5 : 0) + rng.NextDouble(), t);
            AddMeasurement(db, workshop, 1.5 + rng.NextDouble() * 2, t);
        }

        db.DeviceErrors.Add(new DeviceError
        {
            Device = device,
            Code = "SENSOR_TIMEOUT",
            Message = "Channel 2 sensor did not respond for 3 consecutive reads",
            Severity = "warning",
            Timestamp = now.AddHours(-5),
            ReceivedAt = now.AddHours(-5),
        });
        db.SaveChanges();

        db.Rules.AddRange(
            new Rule
            {
                UserId = user.Id,
                Sensor = mainLine,
                Operator = "gt",
                Threshold = 20,
                Severity = "warning",
                Message = "Main line current above 20 A",
                CooldownMinutes = 30,
            },
            new Rule
            {
                UserId = user.Id,
                Sensor = mainLine,
                Operator = "gt",
                Threshold = 28,
                Severity = "critical",
                Message = "Main line current near capacity",
                CooldownMinutes = 10,
            },
            new Rule
            {
                UserId = user.Id,
                Sensor = hvac,
                Operator = "gt",
                Threshold = 12,
                Severity = "warning",
                Message = "HVAC drawing more than expected",
                CooldownMinutes = 30,
            });

        db.SaveChanges();

        db.Alerts.Add(new Alert
        {
            RuleId = db.Rules.First(r => r.Threshold == 20).Id,
            SensorId = mainLine.Id,
            DeviceId = device.Id,
            Value = 23.4,
            Message = "Main line current above 20 A",
            Severity = "warning",
            CreatedAt = now.AddHours(-3),
        });
        db.SaveChanges();
    }

    private static void AddMeasurement(EccAiDbContext db, Sensor sensor, double value, DateTime t)
    {
        db.Measurements.Add(new Measurement
        {
            SensorId = sensor.Id,
            Value = Math.Round(value, 2),
            Timestamp = t,
            ReceivedAt = t,
        });
    }
}
