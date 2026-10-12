using EccAi.Api.Data;
using EccAi.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? builder.Configuration.GetConnectionString("Postgres")
    ?? "Data Source=eccai.db";

builder.Services.AddDbContext<EccAiDbContext>(options =>
{
    if (connectionString.Contains("Host=") || connectionString.Contains("Server=") || connectionString.Contains("Username=") || connectionString.Contains("Password=") || connectionString.Contains("Database="))
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        options.UseSqlite(connectionString);
    }
});
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<RuleEngine>();

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<EccAiDbContext>();
    db.Database.EnsureCreated();
    SeedData.Seed(db);
}

app.UseCors();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();
