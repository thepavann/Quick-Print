import { Check, CircleDashed, Loader2, TriangleAlert } from "lucide-react";

import { StatusDot } from "@/components/brand";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/print-config";

const LABEL: Record<string, string> = {
  QUEUED: "Queued",
  DOWNLOADING: "Downloading",
  PRINTING: "Printing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone =
    status === "COMPLETED"
      ? "border-success/25 bg-success-soft text-success"
      : status === "FAILED"
        ? "border-destructive/25 bg-destructive/8 text-destructive"
        : status === "PRINTING" || status === "DOWNLOADING"
          ? "border-brand/25 bg-brand-soft text-brand"
          : status === "CANCELLED"
            ? "border-border bg-muted text-muted-foreground"
            : "border-warning/30 bg-warning-soft text-[oklch(0.5_0.12_72)]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11px] font-medium tracking-tight",
        tone,
        className,
      )}
    >
      <StatusDot
        tone={
          status === "COMPLETED"
            ? "online"
            : status === "FAILED"
              ? "offline"
              : status === "CANCELLED"
                ? "muted"
                : "busy"
        }
        pulse={status === "PRINTING" || status === "DOWNLOADING"}
      />
      {LABEL[status] ?? status}
    </span>
  );
}

const STEPS: Array<{ key: JobStatus | "SUBMITTED"; label: string; hint: string }> = [
  { key: "SUBMITTED", label: "Submitted", hint: "Job created" },
  { key: "QUEUED", label: "Queued", hint: "Waiting for the printer" },
  { key: "DOWNLOADING", label: "Sent to agent", hint: "Print agent fetching your file" },
  { key: "PRINTING", label: "Printing", hint: "On the printer now" },
  { key: "COMPLETED", label: "Completed", hint: "Collect at the counter" },
];

const ORDER = ["SUBMITTED", "QUEUED", "DOWNLOADING", "PRINTING", "COMPLETED"];

function timeLabel(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function StatusTimeline({
  status,
  createdAt,
  startedAt,
  completedAt,
  errorMessage,
}: {
  status: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
}) {
  const failed = status === "FAILED" || status === "CANCELLED";
  const currentIndex = failed ? 1 : Math.max(ORDER.indexOf(status), 1);

  return (
    <ol className="space-y-0">
      {STEPS.map((step, index) => {
        const done = index < currentIndex || status === "COMPLETED";
        const active = index === currentIndex && status !== "COMPLETED" && !failed;
        const stamp =
          step.key === "SUBMITTED"
            ? timeLabel(createdAt)
            : step.key === "PRINTING"
              ? timeLabel(startedAt)
              : step.key === "COMPLETED"
                ? timeLabel(completedAt)
                : null;

        return (
          <li key={step.key} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                  done
                    ? "border-success/30 bg-success-soft text-success"
                    : active
                      ? "border-brand/35 bg-brand-soft text-brand"
                      : "border-border bg-surface-muted text-muted-foreground/60",
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={2.6} />
                ) : active ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2.4} />
                ) : (
                  <CircleDashed className="size-3.5" strokeWidth={2} />
                )}
              </span>
              {index < STEPS.length - 1 ? (
                <span
                  className={cn(
                    "my-1 w-px flex-1 transition-colors",
                    done ? "bg-success/30" : "bg-border",
                  )}
                />
              ) : null}
            </div>
            <div className={cn("pb-5", index === STEPS.length - 1 && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium",
                  done || active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular">{stamp ?? step.hint}</p>
            </div>
          </li>
        );
      })}

      {failed ? (
        <li className="mt-1 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/6 p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-xs leading-relaxed text-destructive">
            {errorMessage ?? "Something went wrong while printing. Please ask at the counter."}
          </p>
        </li>
      ) : null}
    </ol>
  );
}
