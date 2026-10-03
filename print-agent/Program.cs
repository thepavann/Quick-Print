using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

const string Version = "1.0.0";

var configPath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
if (!File.Exists(configPath))
{
    Console.Error.WriteLine($"Missing {configPath}. Copy appsettings.example.json to appsettings.json and configure it.");
    return 2;
}

var config = JsonSerializer.Deserialize<AgentConfig>(
    await File.ReadAllTextAsync(configPath),
    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
) ?? throw new InvalidOperationException("Invalid appsettings.json");

if (string.IsNullOrWhiteSpace(config.ApiBaseUrl) || string.IsNullOrWhiteSpace(config.AgentToken))
    throw new InvalidOperationException("ApiBaseUrl and AgentToken are required.");

var apiBase = config.ApiBaseUrl.TrimEnd('/');
Directory.CreateDirectory(config.WorkDirectory);

using var http = new HttpClient
{
    BaseAddress = new Uri(apiBase),
    Timeout = TimeSpan.FromSeconds(60)
};
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config.AgentToken);
http.DefaultRequestHeaders.UserAgent.ParseAdd($"QuickPrint-Agent/{Version}");

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

Console.WriteLine($"QuickPrint Print Agent {Version}");
Console.WriteLine($"API: {apiBase}");
Console.WriteLine($"Work directory: {config.WorkDirectory}");

var heartbeatTask = HeartbeatLoopAsync(http, config, cts.Token);
var workerTask = WorkerLoopAsync(http, config, cts.Token);

await Task.WhenAll(heartbeatTask, workerTask);

static async Task HeartbeatLoopAsync(HttpClient http, AgentConfig config, CancellationToken ct)
{
    using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
    while (!ct.IsCancellationRequested)
    {
        try { await SendHeartbeatAsync(http, config, ct); }
        catch (Exception ex) { Console.WriteLine($"[heartbeat] {ex.Message}"); }

        try
        {
            if (!await timer.WaitForNextTickAsync(ct)) break;
        }
        catch (OperationCanceledException) { break; }
    }
}

static async Task SendHeartbeatAsync(HttpClient http, AgentConfig config, CancellationToken ct)
{
    var printerStatus = GetPrinterStatus(config.PrinterName);
    var payload = new
    {
        agentVersion = Version,
        hostname = Environment.MachineName,
        printerName = config.PrinterName,
        printerStatus
    };

    using var response = await http.PostAsync(
        "/api/public/print-agent/heartbeat",
        JsonContent(payload),
        ct
    );
    var body = await response.Content.ReadAsStringAsync(ct);
    if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"HTTP {(int)response.StatusCode}: {body}");
    Console.WriteLine($"[heartbeat] {DateTime.Now:T} printer={printerStatus}");
}

static async Task WorkerLoopAsync(HttpClient http, AgentConfig config, CancellationToken ct)
{
    while (!ct.IsCancellationRequested)
    {
        try
        {
            var claimed = await ClaimNextAsync(http, ct);
            if (claimed is null)
            {
                await Task.Delay(TimeSpan.FromSeconds(Math.Max(1, config.PollSeconds)), ct);
                continue;
            }

            await ProcessJobAsync(http, config, claimed, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
        catch (Exception ex)
        {
            Console.WriteLine($"[worker] {ex.Message}");
            await Task.Delay(TimeSpan.FromSeconds(3), ct);
        }
    }
}

static async Task<Job?> ClaimNextAsync(HttpClient http, CancellationToken ct)
{
    using var response = await http.PostAsync(
        "/api/public/print-agent/jobs/next/claim",
        JsonContent(new { }),
        ct
    );
    var body = await response.Content.ReadAsStringAsync(ct);
    if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Claim HTTP {(int)response.StatusCode}: {body}");

    using var doc = JsonDocument.Parse(body);
    var root = doc.RootElement;
    if (!root.TryGetProperty("job", out var jobElement) || jobElement.ValueKind == JsonValueKind.Null)
        return null;

    return new Job(
        jobElement.GetProperty("id").GetString()!,
        jobElement.GetProperty("jobNumber").GetInt32(),
        jobElement.GetProperty("filename").GetString() ?? "print.pdf",
        jobElement.GetProperty("downloadUrl").GetString(),
        jobElement.GetProperty("printerName").GetString(),
        jobElement.GetProperty("printSettings").GetString()
    );
}

static async Task ProcessJobAsync(HttpClient http, AgentConfig config, Job job, CancellationToken ct)
{
    var safeName = string.Join("_", job.Filename.Split(Path.GetInvalidFileNameChars()));
    var filePath = Path.Combine(config.WorkDirectory, $"{job.JobNumber}_{safeName}");

    try
    {
        if (string.IsNullOrWhiteSpace(job.DownloadUrl))
            throw new InvalidOperationException("Server did not return a signed download URL.");
        if (string.IsNullOrWhiteSpace(job.PrinterName))
            throw new InvalidOperationException("No Windows printer is configured for this station.");
        if (string.IsNullOrWhiteSpace(job.PrintSettings))
            throw new InvalidOperationException("Server did not return print settings.");

        Console.WriteLine($"[job {job.JobNumber}] downloading {job.Filename}");
        await SetStatusAsync(http, job.Id, "DOWNLOADING", null, ct);

        using (var response = await http.GetAsync(job.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, ct))
        {
            response.EnsureSuccessStatusCode();
            await using var source = await response.Content.ReadAsStreamAsync(ct);
            await using var destination = File.Create(filePath);
            await source.CopyToAsync(destination, ct);
        }

        Console.WriteLine($"[job {job.JobNumber}] printing to {job.PrinterName}");
        await SetStatusAsync(http, job.Id, "PRINTING", null, ct);

        var exitCode = await RunSumatraAsync(
            config.SumatraPath,
            job.PrinterName,
            job.PrintSettings,
            filePath,
            ct
        );

        if (exitCode != 0)
            throw new InvalidOperationException($"SumatraPDF returned exit code {exitCode}.");

        await SetStatusAsync(http, job.Id, "COMPLETED", null, ct);
        Console.WriteLine($"[job {job.JobNumber}] completed");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[job {job.JobNumber}] FAILED: {ex.Message}");
        try { await SetStatusAsync(http, job.Id, "FAILED", ex.Message, ct); } catch { }
    }
    finally
    {
        try { if (File.Exists(filePath)) File.Delete(filePath); } catch { }
    }
}

static async Task<int> RunSumatraAsync(string executable, string printerName, string printSettings, string filePath, CancellationToken ct)
{
    if (!File.Exists(executable))
        throw new FileNotFoundException("SumatraPDF.exe was not found.", executable);

    var psi = new ProcessStartInfo { FileName = executable, UseShellExecute = false, CreateNoWindow = true };
    psi.ArgumentList.Add("-print-to");
    psi.ArgumentList.Add(printerName);
    psi.ArgumentList.Add("-print-settings");
    psi.ArgumentList.Add(printSettings);
    psi.ArgumentList.Add("-silent");
    psi.ArgumentList.Add("-exit-when-done");
    psi.ArgumentList.Add(filePath);

    using var process = Process.Start(psi) ?? throw new InvalidOperationException("Could not start SumatraPDF.");
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
    timeout.CancelAfter(TimeSpan.FromMinutes(3));
    try { await process.WaitForExitAsync(timeout.Token); }
    catch (OperationCanceledException)
    {
        try { process.Kill(true); } catch { }
        throw new InvalidOperationException("Printer did not respond within 3 minutes.");
    }
    return process.ExitCode;
}

static string GetPrinterStatus(string? printerName)
{
    if (string.IsNullOrWhiteSpace(printerName)) return "OFFLINE";
    try
    {
        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        psi.ArgumentList.Add("-NoProfile");
        psi.ArgumentList.Add("-NonInteractive");
        psi.ArgumentList.Add("-Command");
        psi.ArgumentList.Add($"(Get-Printer -Name '{printerName.Replace("'", "''")}').PrinterStatus");
        using var process = Process.Start(psi);
        if (process is null) return "OFFLINE";
        var output = process.StandardOutput.ReadToEnd().Trim();
        process.WaitForExit(5000);
        return output.Equals("Normal", StringComparison.OrdinalIgnoreCase) ||
               output.Equals("Printing", StringComparison.OrdinalIgnoreCase) ||
               output.Equals("WarmingUp", StringComparison.OrdinalIgnoreCase)
            ? "ONLINE"
            : "OFFLINE";
    }
    catch { return "OFFLINE"; }
}

static StringContent JsonContent(object value) =>
    new(JsonSerializer.Serialize(value), Encoding.UTF8, "application/json");

record AgentConfig(string ApiBaseUrl, string AgentToken, string SumatraPath, string WorkDirectory, int PollSeconds = 3, string? PrinterName = null);
record Job(string Id, int JobNumber, string Filename, string? DownloadUrl, string? PrinterName, string? PrintSettings);
