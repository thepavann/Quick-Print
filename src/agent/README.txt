QuickPrint Print Agent - setup in 4 steps
==========================================

1. Unzip this folder to  C:\QuickPrint
2. Install SumatraPDF (free) from https://www.sumatrapdfreader.org
3. Double-click  start-agent.bat
   - The first time, paste your agent key (Dashboard > Printer > Create agent key).
4. Leave the black window open. Jobs print automatically.

Start automatically with Windows:
  Press Win+R, type  shell:startup , press Enter,
  then put a shortcut to start-agent.bat in that folder.

Settings are in config.json (website address, agent key, printer name).
If "printerName" is empty the Windows default printer is used.
