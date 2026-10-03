/**
 * Builds the silent print command the Windows Print Agent runs locally.
 * Nothing here ever executes in the browser — the dashboard only *displays* it,
 * and the agent receives the same settings string from the claim endpoint.
 */
import type { ColorMode, PaperSize } from "./print-config";

export interface AgentPrintSettings {
  copies: number;
  color: ColorMode;
  duplex: boolean;
  paper: PaperSize;
  pageRange: string | null;
}

/** SumatraPDF `-print-settings` value, e.g. "2x,monochrome,duplexlong,paper=A4". */
export function buildPrintSettings(settings: AgentPrintSettings): string {
  const parts: string[] = [];
  const copies = Math.min(Math.max(Math.round(settings.copies), 1), 20);
  if (settings.pageRange) parts.push(settings.pageRange.replace(/\s+/g, ""));
  parts.push(`${copies}x`);
  parts.push(settings.color === "BW" ? "monochrome" : "color");
  parts.push(settings.duplex ? "duplexlong" : "simplex");
  parts.push(`paper=${settings.paper}`);
  return parts.join(",");
}

/** Escapes a value for a double-quoted Windows command argument. */
export function quoteWindowsArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildSumatraCommand(args: {
  printerName: string;
  filePath: string;
  settings: AgentPrintSettings;
}): string {
  return [
    "SumatraPDF.exe",
    "-print-to",
    quoteWindowsArg(args.printerName),
    "-print-settings",
    quoteWindowsArg(buildPrintSettings(args.settings)),
    "-silent",
    quoteWindowsArg(args.filePath),
  ].join(" ");
}

export const AGENT_HEARTBEAT_SECONDS = 15;
export const AGENT_OFFLINE_AFTER_SECONDS = 60;

export function isAgentOnline(lastHeartbeatAt: string | null | undefined): boolean {
  if (!lastHeartbeatAt) return false;
  return Date.now() - new Date(lastHeartbeatAt).getTime() < AGENT_OFFLINE_AFTER_SECONDS * 1000;
}
