using EccAi.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EccAi.Api.Data;

public class EccAiDbContext(DbContextOptions<EccAiDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<AuthToken> AuthTokens => Set<AuthToken>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<PairingCode> PairingCodes => Set<PairingCode>();
    public DbSet<Sensor> Sensors => Set<Sensor>();
    public DbSet<Measurement> Measurements => Set<Measurement>();
    public DbSet<DeviceError> DeviceErrors => Set<DeviceError>();
    public DbSet<Rule> Rules => Set<Rule>();
    public DbSet<Alert> Alerts => Set<Alert>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<AuthToken>().HasIndex(t => t.Token).IsUnique();
        modelBuilder.Entity<Device>().HasIndex(d => d.ApiKey).IsUnique();
        modelBuilder.Entity<Device>().HasIndex(d => d.HardwareId).IsUnique();
        modelBuilder.Entity<PairingCode>().HasIndex(p => p.Code).IsUnique();
        modelBuilder.Entity<Sensor>().HasIndex(s => new { s.DeviceId, s.Key }).IsUnique();
        modelBuilder.Entity<Measurement>().HasIndex(m => new { m.SensorId, m.Timestamp });
        modelBuilder.Entity<Alert>().HasIndex(a => new { a.DeviceId, a.CreatedAt });
    }
}
