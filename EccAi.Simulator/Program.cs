using System.Net.Http.Json;

var options = SimOptions.Parse(args);
if (options is null)
{
    return;
}

using var http = new HttpClient { BaseAddress = new Uri(options.ApiUrl) };

string? apiKey = options.ApiKey;

if (apiKey is null)
{
    if (string.IsNullOrWhiteSpace(options.PairingCode))
    {
        Console.WriteLine("No --key supplied, so a --code is required to pair. Example:");
        Console.WriteLine("  dotnet run --project EccAi.Simulator -- --code ABCD1234 --name \"Workshop MCU\"");
        return;
    }

    Console.WriteLine($"Pairing device '{options.Name}' using code {options.PairingCode}...");
    var pairResponse = await http.PostAsJsonAsync("/api/device/pair", new
    {
        code = options.PairingCode,
        hardwareId = options.HardwareId,
        name = options.Name,
    });

    if (!pairResponse.IsSuccessStatusCode)
    {
        Console.WriteLine($"Pairing failed: {(int)pairResponse.StatusCode} {await pairResponse.Content.ReadAsStringAsync()}");
        return;
    }

    var paired = await pairResponse.Content.ReadFromJsonAsync<PairResult>();
    apiKey = paired!.ApiKey;
    Console.WriteLine($"Paired. Device id {paired.Id}, api key: {apiKey}");
    Console.WriteLine("Store this key and reuse it with --key to avoid re-pairing.");
}

http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);

Console.WriteLine($"Streaming from {options.ApiUrl} every {options.IntervalSeconds}s. Ctrl+C to stop.");

var rng = new Random();
var ticks = 0;

while (true)
{
    ticks++;

    DeviceConfig? config;
    try
    {
        config = await http.GetFromJsonAsync<DeviceConfig>("/api/device/config");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Could not reach server: {ex.Message}");
        await Task.Delay(TimeSpan.FromSeconds(options.IntervalSeconds));
        continue;
    }

    if (config is null || config.Sensors.Count == 0)
    {
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] No sensors configured yet. Add sensors in the web UI to start receiving data.");
        await Task.Delay(TimeSpan.FromSeconds(options.IntervalSeconds));
        continue;
    }

    var readings = new List<object>();
    var summary = new List<string>();

    foreach (var sensor in config.Sensors)
    {
        var max = sensor.MaxExpected is > 0 ? sensor.MaxExpected.Value : 20;
        var normal = max * 0.5;
        var value = normal + Math.Sin((ticks + sensor.Key.GetHashCode()) / 4.0) * (max * 0.15) + rng.NextDouble() * (max * 0.05);

        if (rng.NextDouble() < 0.04)
        {
            value = max * (1.05 + rng.NextDouble() * 0.2);
        }

        readings.Add(new { key = sensor.Key, value = Math.Round(value, 2), timestamp = DateTimeOffset.UtcNow });
        summary.Add($"{sensor.Name}={value:0.00}");
    }

    var ingest = await http.PostAsJsonAsync("/api/device/measurements", new { readings });
    var alerts = new List<string>();
    if (ingest.IsSuccessStatusCode)
    {
        var body = await ingest.Content.ReadFromJsonAsync<IngestResult>();
        alerts.AddRange(body?.Alerts.Select(a => $"{a.Severity}: {a.Message}") ?? []);
    }

    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {string.Join(", ", summary)}"
        + (alerts.Count > 0 ? $"  ALERTS -> {string.Join(" | ", alerts)}" : ""));

    if (rng.NextDouble() < 0.03)
    {
        await http.PostAsJsonAsync("/api/device/errors", new
        {
            code = "SENSOR_FLUCTUATION",
            message = "Detected unstable reading on a current channel",
            severity = "warning",
            timestamp = DateTimeOffset.UtcNow,
        });
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Sent device warning to server.");
    }

    await Task.Delay(TimeSpan.FromSeconds(options.IntervalSeconds));
}

internal sealed record SimOptions(
    string ApiUrl,
    string? PairingCode,
    string HardwareId,
    string Name,
    string? ApiKey,
    int IntervalSeconds)
{
    public static SimOptions? Parse(string[] args)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            if (args[i].StartsWith("--") && i + 1 < args.Length)
            {
                map[args[i][2..]] = args[i + 1];
                i++;
            }
        }

        var interval = map.TryGetValue("interval", out var raw) && int.TryParse(raw, out var parsed) && parsed > 0
            ? parsed
            : 5;

        return new SimOptions(
            map.GetValueOrDefault("api", "http://localhost:5000"),
            map.GetValueOrDefault("code"),
            map.GetValueOrDefault("hardware-id", "ESP32-SIM-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()),
            map.GetValueOrDefault("name", "Simulated MCU"),
            map.GetValueOrDefault("key"),
            interval);
    }
}

internal sealed record PairResult(int Id, string ApiKey, string Name);

internal sealed record DeviceConfig(string Name, string HardwareId, List<SensorConfig> Sensors);

internal sealed record SensorConfig(int Id, string Key, string Name, string Unit, double? MaxExpected);

internal sealed record IngestResult(int Accepted, List<AlertResult> Alerts);

internal sealed record AlertResult(int Id, string Severity, string Message, double Value, string Sensor);
