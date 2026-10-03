import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { Loader2, WifiOff } from "lucide-react";

import { Logo } from "@/components/brand";
import { StatusBadge, StatusTimeline } from "@/components/job-status";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, jobLabel } from "@/lib/print-config";
import { getJobStatus } from "@/lib/print.functions";

export const Route = createFileRoute("/print/job/$jobId")({
  head: () => ({
    meta: [
      { title: "Your print job · QuickPrint" },
      {
        name: "description",
        content:
          "Live status of your QuickPrint job: queued, printing or ready to collect at the stationery counter.",
      },
      { property: "og:title", content: "Your print job · QuickPrint" },
      {
        property: "og:description",
        content: "Track your print job and collect it at the counter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobStatusPage,
});

const MESSAGES: Record<string, string> = {
  QUEUED: "Your document is queued.",
  DOWNLOADING: "The counter's print agent is fetching your document.",
  PRINTING: "Your document is printing.",
  COMPLETED: "Print completed. Collect your document at the counter.",
  FAILED: "Something went wrong while printing.",
  CANCELLED: "This job was cancelled at the counter.",
};

function JobStatusPage() {
  const { jobId } = Route.useParams();
  const fetchStatus = useServerFn(getJobStatus);

  const { data, isPending, refetch } = useQuery({
    queryKey: ["job-status", jobId],
    queryFn: () => fetchStatus({ data: { jobId } }),
    refetchInterval: (query) => {
      const result = query.state.data;
      if (result?.ok && (result.job.status === "COMPLETED" || result.job.status === "FAILED")) {
        return false;
      }
      return 4000;
    },
  });

  // Realtime keeps the screen in step with the print agent without polling delays.
  useEffect(() => {
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "print_jobs", filter: `id=eq.${jobId}` },
        () => void refetch(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [jobId, refetch]);

  // Buzz and chime once when the print finishes.
  const currentStatus = data?.ok ? data.job.status : null;
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    if (prevStatus.current && prevStatus.current !== "COMPLETED" && currentStatus === "COMPLETED") {
      try {
        navigator.vibrate?.([200, 100, 200]);
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 1046;
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.65);
      } catch {
        // ignore
      }
    }
    prevStatus.current = currentStatus;
  }, [currentStatus]);


  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-muted/50">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your print job...
        </div>
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-muted/50 px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">Job not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This print job link is no longer valid. Please ask at the counter.
          </p>
        </div>
      </div>
    );
  }

  const job = data.job;
  const station = (job as { station?: { name?: string } | null }).station;

  return (
    <div className="min-h-screen bg-surface-muted/50 pb-16">
      <header className="border-b border-border bg-surface/85 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between">
          <Logo size="sm" />
          <StatusBadge status={job.status} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-5 pt-6">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs-soft">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {jobLabel(job.job_number)}
          </p>
          <h1 className="mt-2 truncate text-lg font-semibold tracking-tight text-foreground">
            {job.filename}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.printed_pages} pages × {job.copies} {job.copies === 1 ? "copy" : "copies"} ·{" "}
            {job.paper} · {job.color === "COLOR" ? "Colour" : "B&W"} ·{" "}
            {job.duplex ? "Double-sided" : "Single-sided"}
          </p>

          <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-4 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Pickup code</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
              {jobLabel(job.job_number)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Show this at the counter to collect your prints.</p>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
            <span className="text-sm text-muted-foreground">Pay at counter</span>
            <span className="text-lg font-semibold tabular text-foreground">
              {formatMoney(job.amount)}
            </span>
          </div>

          <p className="mt-4 text-sm font-medium text-foreground">
            {MESSAGES[job.status] ?? "Your job is being processed."}
          </p>
          {station?.name ? (
            <p className="mt-1 text-xs text-muted-foreground">at {station.name}</p>
          ) : null}
        </div>

        {!data.printerOnline && (job.status === "QUEUED" || job.status === "DOWNLOADING") ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3.5">
            <WifiOff className="mt-0.5 size-4 shrink-0 text-[oklch(0.5_0.12_72)]" />
            <p className="text-xs leading-relaxed text-[oklch(0.42_0.1_72)]">
              Printer is currently offline. Your job will remain queued.
            </p>
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-xs-soft">
          <h2 className="mb-4 text-sm font-semibold tracking-tight text-foreground">Progress</h2>
          <StatusTimeline
            status={job.status}
            createdAt={job.created_at}
            startedAt={job.started_at}
            completedAt={job.completed_at}
            errorMessage={job.error_message}
          />
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          Keep this screen open — it updates on its own.
        </p>
      </main>
    </div>
  );
}
