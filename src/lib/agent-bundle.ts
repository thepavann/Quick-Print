/** Builds the downloadable Windows Print Agent ZIP in the browser. */
import { strToU8, zipSync } from "fflate";

import readme from "@/agent/README.txt?raw";
import runAgent from "@/agent/run-agent.ps1?raw";
import startBat from "@/agent/start-agent.bat?raw";

const crlf = (s: string) => s.replace(/\r?\n/g, "\r\n");

export function downloadAgentZip(opts: { apiBaseUrl: string; agentKey?: string | null; printerName?: string | null }) {
  const config = {
    apiBaseUrl: opts.apiBaseUrl,
    agentKey: opts.agentKey ?? "",
    printerName: opts.printerName ?? "",
    sumatraPath: "",
  };
  const zip = zipSync({
    QuickPrint: {
      "start-agent.bat": strToU8(crlf(startBat)),
      "run-agent.ps1": strToU8(crlf(runAgent)),
      "config.json": strToU8(JSON.stringify(config, null, 2)),
      "README.txt": strToU8(crlf(readme)),
    },
  });
  const blob = new Blob([zip], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "QuickPrint-Agent.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
