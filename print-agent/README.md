# QuickPrint Windows Print Agent

This agent is the physical-printing bridge between the QuickPrint web app and a Windows printer.

## What it does

- Authenticates with the one-time qpa_ agent token.
- Sends a heartbeat every 15 seconds.
- Reports the configured Windows printer state.
- Claims jobs atomically from QuickPrint.
- Downloads the private PDF through the server's short-lived signed URL.
- Sends page range, copies, colour, duplex and paper settings to SumatraPDF.
- Reports PRINTING, COMPLETED or FAILED.
- Deletes the local PDF after the job finishes.

The web app never talks directly to a Windows printer.

## Requirements

- Windows 10/11
- .NET 8 SDK/runtime
- SumatraPDF installed on the counter PC
- The counter PC can reach your deployed QuickPrint URL

SumatraPDF supports silent -print-to, -print-settings and -silent command-line printing.

## Setup

1. Open QuickPrint Dashboard -> Printer & Print Agent.
2. Save the exact Windows printer name.
3. Click Create agent key and copy the token. It is shown only once.
4. Install SumatraPDF.
5. Install .NET 8 SDK.
6. Copy appsettings.example.json to appsettings.json.
7. Set ApiBaseUrl, AgentToken, SumatraPath, WorkDirectory and PrinterName.
8. Test from this directory with: dotnet run
9. For production publish with:
   dotnet publish -c Release -r win-x64 --self-contained true
10. Copy the published output and appsettings.json to the counter PC.

## Production

Run the published QuickPrint.Agent.exe with Windows Task Scheduler in the same Windows user context that owns the installed printer. The included install-task.ps1 registers an At Log On task for the current user and configures automatic restarts.

## Security

The agent token is a secret. Never put it in browser code, GitHub source, or public screenshots.

The agent only receives jobs for the station to which its token is bound.
