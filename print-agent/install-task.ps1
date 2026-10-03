param(
  [string]$AgentDirectory = "C:\QuickPrint\Agent"
)

$exe = Join-Path $AgentDirectory "QuickPrint.Agent.exe"
$config = Join-Path $AgentDirectory "appsettings.json"

if (!(Test-Path $exe)) { throw "Agent executable not found: $exe" }
if (!(Test-Path $config)) { throw "appsettings.json not found: $config" }

$currentUser = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute $exe -WorkingDirectory $AgentDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$settings = New-ScheduledTaskSettingsSet -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType InteractiveToken -RunLevel Highest

Register-ScheduledTask -TaskName "QuickPrint Windows Print Agent" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
Start-ScheduledTask -TaskName "QuickPrint Windows Print Agent"

Write-Host "QuickPrint Print Agent scheduled task installed and started for $currentUser."
