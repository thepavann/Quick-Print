# QuickPrint Windows Print Agent (PowerShell)
# Keeps this PC connected to QuickPrint and prints jobs silently with SumatraPDF.
# Browser printing is never used.

$ErrorActionPreference = "Stop"
$AgentVersion = "2.0.0"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $Root "config.json"
$JobsDir = Join-Path $Root "jobs"
$DoneDir = Join-Path $Root "Completed"
New-Item -ItemType Directory -Force -Path $JobsDir, $DoneDir | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$Api = $Config.apiBaseUrl.TrimEnd("/")

if (-not $Config.agentKey -or $Config.agentKey -notlike "qpa_*") {
  $key = Read-Host "Paste your agent key from Dashboard > Printer (starts with qpa_)"
  $key = $key.Trim().Trim('"')
  if ($key -notlike "qpa_*") { Write-Host "That does not look like an agent key." -ForegroundColor Red; Read-Host "Press Enter to close"; exit 1 }
  $Config.agentKey = $key
  $Config | ConvertTo-Json | Set-Content $ConfigPath -Encoding UTF8
}

$Headers = @{ Authorization = "Bearer " + $Config.agentKey; "User-Agent" = "QuickPrint-Agent/$AgentVersion" }

function Find-Sumatra {
  $candidates = @(
    $Config.sumatraPath,
    "$env:ProgramFiles\SumatraPDF\SumatraPDF.exe",
    "${env:ProgramFiles(x86)}\SumatraPDF\SumatraPDF.exe",
    "$env:LOCALAPPDATA\SumatraPDF\SumatraPDF.exe",
    (Join-Path $Root "SumatraPDF.exe")
  )
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  return $null
}

function Get-PrinterName {
  if ($Config.printerName) { return $Config.printerName }
  try { return (Get-CimInstance Win32_Printer | Where-Object { $_.Default }).Name } catch { return $null }
}

function Get-PrinterState($name) {
  try {
    $p = Get-Printer -Name $name -ErrorAction Stop
    if ($p.PrinterStatus -in @("Normal", "Printing", "WarmingUp", "Idle")) { return "ONLINE" }
    return "OFFLINE"
  } catch { return "OFFLINE" }
}

function Is-VirtualPrinter($name) {
  return ($name -match "PDF|XPS|OneNote|Fax")
}

function Post-Json($path, $body) {
  return Invoke-RestMethod -Method Post -Uri ($Api + $path) -Headers $Headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Compress) -TimeoutSec 60
}

function Set-JobStatus($id, $status, $err) {
  $b = @{ status = $status }
  if ($err) { $b.errorMessage = $err.Substring(0, [Math]::Min(480, $err.Length)) }
  try { Post-Json "/api/public/print-agent/jobs/$id/status" $b | Out-Null } catch { Write-Host "  Could not report status: $($_.Exception.Message)" -ForegroundColor Yellow }
}

$Sumatra = Find-Sumatra
$PrinterName = Get-PrinterName
Write-Host ""
Write-Host "QuickPrint Print Agent $AgentVersion" -ForegroundColor Cyan
Write-Host "Website : $Api"
Write-Host "Printer : $PrinterName"
if ($Sumatra) { Write-Host "Sumatra : $Sumatra" } else { Write-Host "Sumatra : NOT FOUND - install SumatraPDF from sumatrapdfreader.org" -ForegroundColor Red }
Write-Host "Keep this window open. Press Ctrl+C to stop."
Write-Host ""

$lastBeat = [DateTime]::MinValue
while ($true) {
  try {
    if (((Get-Date) - $lastBeat).TotalSeconds -ge 15) {
      $state = if ($PrinterName) { Get-PrinterState $PrinterName } else { "OFFLINE" }
      $hb = @{ agentVersion = $AgentVersion; hostname = $env:COMPUTERNAME; printerStatus = $state }
      if ($PrinterName) { $hb.printerName = $PrinterName }
      Post-Json "/api/public/print-agent/heartbeat" $hb | Out-Null
      $lastBeat = Get-Date
      Write-Host "[$(Get-Date -Format T)] Connected. Printer: $state"
    }

    $claim = Post-Json "/api/public/print-agent/jobs/next/claim" @{}
    if (-not $claim.job) { Start-Sleep -Seconds 3; continue }

    $job = $claim.job
    $num = $job.jobNumber
    $safe = ($job.filename -replace '[\\/:*?"<>|]', '_')
    $file = Join-Path $JobsDir ("QP-$num" + "_" + $safe)
    if (-not $file.ToLower().EndsWith(".pdf")) { $file = $file + ".pdf" }
    Write-Host "[$(Get-Date -Format T)] Job QP-$num : downloading $($job.filename)" -ForegroundColor Cyan

    try {
      if (-not $job.downloadUrl) { throw "Server did not send a download link." }
      if (-not $Sumatra) { throw "SumatraPDF is not installed on the counter PC." }
      $target = if ($job.printerName) { $job.printerName } else { $PrinterName }
      if (-not $target) { throw "No printer is configured." }

      Invoke-WebRequest -Uri $job.downloadUrl -OutFile $file -UseBasicParsing -TimeoutSec 120

      Set-JobStatus $job.id "PRINTING" $null
      if (Is-VirtualPrinter $target) {
        Copy-Item $file (Join-Path $DoneDir (Split-Path $file -Leaf)) -Force
        Write-Host "  Test printer '$target' - saved copy to $DoneDir (no paper printed)." -ForegroundColor Yellow
      } else {
        Write-Host "  Printing to $target ..."
        $sargs = @("-print-to", "`"$target`"", "-print-settings", "`"$($job.printSettings)`"", "-silent", "-exit-when-done", "`"$file`"")
        $p = Start-Process -FilePath $Sumatra -ArgumentList $sargs -PassThru -WindowStyle Hidden
        if (-not $p.WaitForExit(180000)) { try { $p.Kill() } catch {}; throw "Printer did not respond within 3 minutes." }
        if ($p.ExitCode -ne 0) { throw "SumatraPDF exit code $($p.ExitCode)." }
      }
      Set-JobStatus $job.id "COMPLETED" $null
      Write-Host "  Job QP-$num completed." -ForegroundColor Green
    } catch {
      $msg = $_.Exception.Message
      Write-Host "  Job QP-$num FAILED: $msg" -ForegroundColor Red
      Set-JobStatus $job.id "FAILED" $msg
    } finally {
      if (Test-Path $file) { Remove-Item $file -Force -ErrorAction SilentlyContinue }
    }
  } catch {
    $m = $_.Exception.Message
    if ($m -match "401") { Write-Host "Agent key rejected. Create a new key in Dashboard > Printer and delete agentKey from config.json." -ForegroundColor Red }
    else { Write-Host "[$(Get-Date -Format T)] Connection problem: $m" -ForegroundColor Yellow }
    Start-Sleep -Seconds 5
  }
}
