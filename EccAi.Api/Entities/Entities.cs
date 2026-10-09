namespace EccAi.Api.Entities;

public class User
{
    public int Id { get; set; }
    public required string Email { get; set; }
    public required string Name { get; set; }
    public List<Device> Devices { get; set; } = [];
}

public class AuthToken
{
    public int Id { get; set; }
    public required string Token { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public class Device
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public required string Name { get; set; }
    public required string HardwareId { get; set; }
    public required string ApiKey { get; set; }
    public DateTime PairedAt { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public List<Sensor> Sensors { get; set; } = [];
    public List<DeviceError> Errors { get; set; } = [];
}

public class PairingCode
{
    public int Id { get; set; }
    public required string Code { get; set; }
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public int? DeviceId { get; set; }
}

public class Sensor
{
    public int Id { get; set; }
    public int DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public required string Key { get; set; }
    public required string Name { get; set; }
    public required string Unit { get; set; }
    public double? MaxExpected { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<Measurement> Measurements { get; set; } = [];
}

public class Measurement
{
    public int Id { get; set; }
    public int SensorId { get; set; }
    public Sensor Sensor { get; set; } = null!;
    public double Value { get; set; }
    public DateTime Timestamp { get; set; }
    public DateTime ReceivedAt { get; set; }
}

public class DeviceError
{
    public int Id { get; set; }
    public int DeviceId { get; set; }
    public Device Device { get; set; } = null!;
    public required string Code { get; set; }
    public required string Message { get; set; }
    public required string Severity { get; set; }
    public DateTime Timestamp { get; set; }
    public DateTime ReceivedAt { get; set; }
    public bool Acknowledged { get; set; }
}

public class Rule
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int SensorId { get; set; }
    public Sensor Sensor { get; set; } = null!;
    public required string Operator { get; set; }
    public double Threshold { get; set; }
    public required string Severity { get; set; }
    public required string Message { get; set; }
    public bool Enabled { get; set; } = true;
    public int CooldownMinutes { get; set; } = 10;
    public DateTime? LastTriggeredAt { get; set; }
}

public class Alert
{
    public int Id { get; set; }
    public int RuleId { get; set; }
    public Rule Rule { get; set; } = null!;
    public int SensorId { get; set; }
    public int DeviceId { get; set; }
    public double Value { get; set; }
    public required string Message { get; set; }
    public required string Severity { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool Acknowledged { get; set; }
}
