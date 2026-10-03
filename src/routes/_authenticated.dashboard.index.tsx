/**
 * Overview: today's counters, live queue and the printer/agent health card.
 * The queue updates over Realtime; the Demo Print Agent buttons only simulate a
 * run and never touch a physical printer.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Banknote,
  CheckCircle2,
  Files,
  Layers,
  ListOrdered,
  Play,
  QrCode,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { StatusDot } from "@/components/brand";
import {
  DemoBadge,
  EmptyState,
  JobStatusBadge,
  PageHeader,
  Panel,
  StatTile,
} from "@/components/dashboard/shell";
import { useOverview, useStationContext } from "@/components/dashboard/use-station";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isAgentOnline } from "@/lib/agent-command";
import { formatMoney, jobLabel, optionsSummary } from "@/lib/print-config";
import {
  advanceDemoJob,
  cancelPrintJob,
  reprintJob,
  setJobPaid,
} from "@/lib/station.functions";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Overview · QuickPrint" }] }),
  component: OverviewPage,
});

function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    // Browser blocked audio; ignore.
  }
}

function PaidButton({
  job,
  onToggle,
  busy,
}: {
  job: { amount: number; paid_at: string | null };
  onToggle: (paid: boolean) => void;
  busy: boolean;
}) {
  const paid = Boolean(job.paid_at);
  return (
    <Button
      size="sm"
      variant={paid ? "secondary" : "outline"}
      className="rounded-lg"
      disabled={busy}
      onClick={() => onToggle(!paid)}
      aria-pressed={paid}
    >
      {paid ? <CheckCircle2 className="size-3.5 text-success" /> : <Banknote className="size-3.5" />}
      {paid ? "Paid" : `Mark paid ${formatMoney(job.amount)}`}
    </Button>
  );
}

function OverviewPage() {
  const overview = useOverview();
  const context = useStationContext();
  const queryClient = useQueryClient();

  const advanceFn = useServerFn(advanceDemoJob);
  const cancelFn = useServerFn(cancelPrintJob);
  const paidFn = useServerFn(setJobPaid);
  const reprintFn = useServerFn(reprintJob);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["overview"] });
    void queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
  };

  const advance = useMutation({
    mutationFn: (input: { jobId: string; outcome: "ADVANCE" | "FAIL" }) => advanceFn({ data: input }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: (jobId: string) => cancelFn({ data: { jobId } }),
    onSuccess: () => {
      toast.success("Job cancelled.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markPaid = useMutation({
    mutationFn: (input: { jobId: string; paid: boolean }) => paidFn({ data: input }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const reprint = useMutation({
    mutationFn: (jobId: string) => reprintFn({ data: { jobId } }),
    onSuccess: () => {
      toast.success("Sent back to the printer.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Soft chime when a new job arrives in the queue.
  const lastTop = useRef<number | null>(null);
  useEffect(() => {
    const numbers = (overview.data?.queue ?? []).map((j: { job_number: number }) => j.job_number);
    const max = numbers.length ? Math.max(...numbers) : 0;
    if (lastTop.current !== null && max > lastTop.current) playChime();
    if (overview.data) lastTop.current = Math.max(lastTop.current ?? 0, max);
  }, [overview.data]);

  const agent = context.data?.agent;
  const printer = context.data?.printer;
  const agentOnline = isAgentOnline(agent?.last_heartbeat_at ?? null);
  const currentJob = overview.data?.queue.find(
    (job: { status: string }) => job.status === "PRINTING" || job.status === "DOWNLOADING",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Everything happening at your counter right now."
        action={
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/dashboard/qr">
              <QrCode className="size-4" />
              QR display
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[7.5rem] rounded-xl" />
          ))
        ) : (
          <>
            <StatTile label="Today's jobs" value={String(overview.data?.todayJobs ?? 0)} icon={Files} />
            <StatTile label="Today's pages" value={String(overview.data?.todayPages ?? 0)} icon={Layers} />
            <StatTile
              label="Today's revenue"
              value={formatMoney(overview.data?.todayRevenue ?? 0)}
              hint={`${formatMoney(overview.data?.todayCollected ?? 0)} collected · ${overview.data?.todayBwPages ?? 0} B&W / ${overview.data?.todayColorPages ?? 0} colour pages`}
              icon={Banknote}
            />
            <StatTile
              label="Current queue"
              value={String(overview.data?.queue.length ?? 0)}
              hint={currentJob ? `Printing ${jobLabel(currentJob.job_number)}` : "Nothing printing"}
              icon={ListOrdered}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Printer & agent" description="Live health of the stationery PC" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <Row label="Print Agent">
              <span className="inline-flex items-center gap-1.5">
                <StatusDot tone={agentOnline ? "online" : "offline"} pulse={agentOnline} />
                {agentOnline ? "Online" : "Offline"}
              </span>
            </Row>
            <Row label="Printer">
              <span className="inline-flex items-center gap-1.5">
                <StatusDot tone={printer?.status === "ONLINE" && agentOnline ? "online" : "offline"} />
                {printer?.status === "ONLINE" && agentOnline ? "Online" : "Offline"}
              </span>
            </Row>
            <Row label="Printer name">{printer?.name ?? "Not configured"}</Row>
            <Row label="Model">{printer?.model ?? "—"}</Row>
            <Row label="Current job">
              {currentJob ? jobLabel(currentJob.job_number) : "Idle"}
            </Row>
            <Row label="Last heartbeat">
              {agent?.last_heartbeat_at ? new Date(agent.last_heartbeat_at).toLocaleTimeString() : "Never"}
            </Row>
            <Row label="Agent version">{agent?.agent_version ?? "—"}</Row>
            <Row label="Last successful print">
              {printer?.last_success_at ? new Date(printer.last_success_at).toLocaleString() : "—"}
            </Row>
          </dl>

          {!agentOnline ? (
            <div className="mt-4 flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Printer is currently offline. New jobs stay queued until the Print Agent connects.{" "}
                <Link to="/dashboard/printer" className="font-medium underline">
                  Set up the agent
                </Link>
                .
              </span>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Live queue"
          description="First in, first printed"
          className="lg:col-span-2"
          flush
          action={<DemoBadge />}
        >
          {overview.isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : (overview.data?.queue.length ?? 0) === 0 ? (
            <EmptyState
              title="The queue is empty"
              description="Jobs appear here the moment a student submits a document from the counter QR."
            />
          ) : (
            <ul className="divide-y divide-border">
              {overview.data?.queue.map(
                (job: {
                  id: string;
                  job_number: number;
                  filename: string;
                  printed_pages: number;
                  copies: number;
                  amount: number;
                  status: string;
                  color: "BW" | "COLOR";
                  duplex: boolean;
                  paper: "A4" | "A3";
                  paid_at: string | null;
                }) => (
                  <li key={job.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className="tabular-nums">{jobLabel(job.job_number)}</span>
                        <span className="truncate text-muted-foreground">{job.filename}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {job.printed_pages} pages × {job.copies} copies · {optionsSummary(job)} ·{" "}
                        {formatMoney(job.amount)}
                      </p>
                    </div>
                    <JobStatusBadge status={job.status} />
                    <div className="flex items-center gap-1.5">
                      <PaidButton job={job} onToggle={(paid) => markPaid.mutate({ jobId: job.id, paid })} busy={markPaid.isPending} />
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={advance.isPending}
                        onClick={() => advance.mutate({ jobId: job.id, outcome: "ADVANCE" })}
                      >
                        <Play className="size-3.5" />
                        Simulate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg text-muted-foreground"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(job.id)}
                      >
                        <XCircle className="size-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent activity" description="Last eight jobs at this counter" flush>
        {(overview.data?.recent.length ?? 0) === 0 ? (
          <EmptyState title="No jobs yet" description="Your first print job will show up here." />
        ) : (
          <ul className="divide-y divide-border">
            {overview.data?.recent.map(
              (job: {
                id: string;
                job_number: number;
                filename: string;
                amount: number;
                status: string;
                created_at: string;
                paid_at: string | null;
                file_purged_at: string | null;
              }) => (
                <li key={job.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="w-20 shrink-0 text-sm tabular-nums text-foreground">
                    {jobLabel(job.job_number)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {job.filename}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {new Date(job.created_at).toLocaleTimeString()}
                  </span>
                  <span className="w-16 text-right text-sm tabular-nums text-foreground">
                    {formatMoney(job.amount)}
                  </span>
                  <JobStatusBadge status={job.status} />
                  <PaidButton job={job} onToggle={(paid) => markPaid.mutate({ jobId: job.id, paid })} busy={markPaid.isPending} />
                  {["COMPLETED", "FAILED", "CANCELLED"].includes(job.status) && !job.file_purged_at ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg"
                      disabled={reprint.isPending}
                      onClick={() => reprint.mutate(job.id)}
                    >
                      <RotateCcw className="size-3.5" />
                      Re-print
                    </Button>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        )}
      </Panel>
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
