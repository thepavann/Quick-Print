/**
 * Printer & Print Agent: printer configuration, agent credential management and
 * the setup instructions for the silent Windows printing agent.
 * Printing never happens in the browser — the agent drives the Windows spooler.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, KeyRound, ShieldAlert, Trash2 } from "lucide-react";

import { downloadAgentZip } from "@/lib/agent-bundle";

/** The agent should always target the public QuickPrint deployment URL. */
function agentApiBase(origin: string) {
  const configured = import.meta.env["VITE_PUBLIC_APP_URL"]?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return origin.replace(/\/$/, "");
}
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/brand";
import { PageHeader, Panel, SaveButton } from "@/components/dashboard/shell";
import { useStationContext } from "@/components/dashboard/use-station";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AGENT_HEARTBEAT_SECONDS,
  buildSumatraCommand,
  isAgentOnline,
} from "@/lib/agent-command";
import { issueAgentToken, revokeAgent, savePrinter } from "@/lib/station.functions";

export const Route = createFileRoute("/_authenticated/dashboard/printer")({
  component: PrinterPage,
});

function PrinterPage() {
  const { data } = useStationContext();
  const queryClient = useQueryClient();

  const savePrinterFn = useServerFn(savePrinter);
  const issueFn = useServerFn(issueAgentToken);
  const revokeFn = useServerFn(revokeAgent);

  const [form, setForm] = useState({
    name: "",
    model: "",
    windows_printer_name: "",
    default_paper: "A4" as "A4" | "A3",
    supports_color: true,
    supports_duplex: true,
  });
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.printer) return;
    setForm({
      name: data.printer.name ?? "",
      model: data.printer.model ?? "",
      windows_printer_name: data.printer.windows_printer_name ?? "",
      default_paper: (data.printer.default_paper ?? "A4") as "A4" | "A3",
      supports_color: data.printer.supports_color ?? true,
      supports_duplex: data.printer.supports_duplex ?? true,
    });
  }, [data?.printer]);

  const save = useMutation({
    mutationFn: () =>
      savePrinterFn({
        data: {
          name: form.name,
          model: form.model.trim() ? form.model.trim() : null,
          windows_printer_name: form.windows_printer_name.trim()
            ? form.windows_printer_name.trim()
            : null,
          default_paper: form.default_paper,
          supports_color: form.supports_color,
          supports_duplex: form.supports_duplex,
        },
      }),
    onSuccess: () => {
      toast.success("Printer saved.");
      void queryClient.invalidateQueries({ queryKey: ["station-context"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const issue = useMutation({
    mutationFn: () => issueFn({ data: { name: "Windows Print Agent" } }),
    onSuccess: (result) => {
      setIssuedToken(result.token);
      toast.success("New agent key created. Copy it now — it is shown only once.");
      void queryClient.invalidateQueries({ queryKey: ["station-context"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (agentId: string) => revokeFn({ data: { agentId } }),
    onSuccess: () => {
      setIssuedToken(null);
      toast.success("Agent access revoked.");
      void queryClient.invalidateQueries({ queryKey: ["station-context"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const agent = data?.agent;
  const agentOnline = isAgentOnline(agent?.last_heartbeat_at ?? null);
  const exampleCommand = buildSumatraCommand({
    printerName: form.windows_printer_name || form.name || "HP LaserJet Pro M404dn",
    filePath: "C:\\QuickPrint\\jobs\\QP-10482.pdf",
    settings: {
      copies: 2,
      color: form.supports_color ? "BW" : "BW",
      duplex: form.supports_duplex,
      paper: form.default_paper,
      pageRange: null,
    },
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printer & Print Agent"
        description="The Print Agent runs on your counter PC, picks up jobs and prints them silently. No one has to click a print dialog."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Printer" description="What the agent should print to">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <Field label="Printer name" htmlFor="name">
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                placeholder="Counter printer"
                className="rounded-lg"
                required
              />
            </Field>
            <Field label="Printer model" htmlFor="model">
              <Input
                id="model"
                value={form.model}
                onChange={(event) => setForm((f) => ({ ...f, model: event.target.value }))}
                placeholder="HP LaserJet Pro M404dn"
                className="rounded-lg"
              />
            </Field>
            <Field
              label="Windows printer name"
              htmlFor="windows"
              hint="Exactly as it appears in Windows Printers & scanners."
            >
              <Input
                id="windows"
                value={form.windows_printer_name}
                onChange={(event) =>
                  setForm((f) => ({ ...f, windows_printer_name: event.target.value }))
                }
                placeholder="HP LaserJet Pro M404dn"
                className="rounded-lg"
              />
            </Field>
            <Field label="Default paper size" htmlFor="paper">
              <div className="flex gap-2">
                {(["A4", "A3"] as const).map((paper) => (
                  <Button
                    key={paper}
                    type="button"
                    variant={form.default_paper === paper ? "default" : "outline"}
                    className="rounded-lg"
                    onClick={() => setForm((f) => ({ ...f, default_paper: paper }))}
                  >
                    {paper}
                  </Button>
                ))}
              </div>
            </Field>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
              <Label className="text-sm font-normal">Supports colour</Label>
              <Switch
                checked={form.supports_color}
                onCheckedChange={(value) => setForm((f) => ({ ...f, supports_color: value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
              <Label className="text-sm font-normal">Supports double-sided</Label>
              <Switch
                checked={form.supports_duplex}
                onCheckedChange={(value) => setForm((f) => ({ ...f, supports_duplex: value }))}
              />
            </div>
            <SaveButton pending={save.isPending} />
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title="Print Agent" description="Health reported from your counter PC">
            <dl className="space-y-3 text-sm">
              <Row label="Status">
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot tone={agentOnline ? "online" : "offline"} pulse={agentOnline} />
                  {agentOnline ? "Print Agent Online" : "Print Agent Offline"}
                </span>
              </Row>
              <Row label="Agent name">{agent?.name ?? "Not connected"}</Row>
              <Row label="Computer">{agent?.hostname ?? "—"}</Row>
              <Row label="Agent version">{agent?.agent_version ?? "—"}</Row>
              <Row label="Reported printer">{agent?.reported_printer_name ?? "—"}</Row>
              <Row label="Reported printer state">{agent?.reported_printer_status ?? "—"}</Row>
              <Row label="Last heartbeat">
                {agent?.last_heartbeat_at
                  ? new Date(agent.last_heartbeat_at).toLocaleString()
                  : "Never"}
              </Row>
              <Row label="Key">{agent?.token_prefix ? `${agent.token_prefix}…` : "—"}</Row>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => issue.mutate()}
                disabled={issue.isPending}
                className="rounded-lg"
              >
                <KeyRound className="size-4" />
                {agent ? "Replace agent key" : "Create agent key"}
              </Button>
              {agent ? (
                <Button
                  variant="outline"
                  className="rounded-lg text-destructive"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(agent.id)}
                >
                  <Trash2 className="size-4" />
                  Revoke
                </Button>
              ) : null}
            </div>

            {issuedToken ? (
              <div className="mt-4 space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <ShieldAlert className="size-3.5" />
                  Copy this key now — it is shown only once.
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-card px-2 py-1.5 text-xs">
                    {issuedToken}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => {
                      void navigator.clipboard.writeText(issuedToken);
                      toast.success("Key copied.");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep it on the counter PC only. Never paste it into a browser page or share it.
                </p>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>

      <Panel
        title="Desktop agent setup"
        description="Download the ready-made agent for your Windows counter PC"
        action={
          <Button
            className="rounded-lg"
            onClick={() => {
              downloadAgentZip({
                apiBaseUrl: agentApiBase(origin),
                agentKey: issuedToken,
                printerName: form.windows_printer_name || null,
              });
              toast.success(
                issuedToken
                  ? "Downloaded with your new agent key included."
                  : "Downloaded. You'll paste your agent key on first start.",
              );
            }}
          >
            <Download className="size-4" />
            Download agent (ZIP)
          </Button>
        }
      >
        <ol className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Install SumatraPDF", "Free, from sumatrapdfreader.org. It prints silently — no dialogs."],
            ["Unzip to C:\\QuickPrint", "The ZIP contains start-agent.bat, run-agent.ps1 and config.json."],
            ["Double-click start-agent.bat", issuedToken ? "Your new key is already inside the ZIP." : "Paste your agent key once when asked."],
            ["Leave the window open", "Jobs print automatically. It restarts itself if it stops."],
          ].map(([title, body], i) => (
            <li key={title} className="rounded-lg border border-border p-3.5">
              <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground">
                {i + 1}
              </span>
              <p className="mt-2 font-medium text-foreground">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Tip: create a fresh agent key above <em>before</em> downloading and it is packed into the ZIP
          automatically. To start with Windows, place a shortcut to start-agent.bat in the{" "}
          <code className="rounded bg-muted px-1">shell:startup</code> folder.
        </p>
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Technical details</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-foreground">
{`POST ${agentApiBase(origin)}/api/public/print-agent/heartbeat   every ${AGENT_HEARTBEAT_SECONDS}s
POST ${agentApiBase(origin)}/api/public/print-agent/jobs/next/claim
POST ${agentApiBase(origin)}/api/public/print-agent/jobs/{id}/status

${exampleCommand}`}
          </pre>
        </details>
      </Panel>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}
