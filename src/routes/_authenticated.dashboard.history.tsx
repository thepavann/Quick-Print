/**
 * History: the station's audit trail — QR rotations, job state changes, pricing
 * and settings edits, agent key changes.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { EmptyState, PageHeader, Panel } from "@/components/dashboard/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { listAuditLogs } from "@/lib/station.functions";

export const Route = createFileRoute("/_authenticated/dashboard/history")({
  component: HistoryPage,
});

const ACTION_LABELS: Record<string, string> = {
  "qr_session.rotated": "QR code refreshed",
  "print_job.submitted": "Job submitted",
  "print_job.claimed": "Job picked up by the agent",
  "print_job.downloading": "Agent downloading the document",
  "print_job.printing": "Printing started",
  "print_job.completed": "Print completed",
  "print_job.failed": "Print failed",
  "pricing.updated": "Pricing updated",
  "station.settings_updated": "Station settings updated",
  "agent.token_issued": "Agent key issued",
};

function HistoryPage() {
  const listFn = useServerFn(listAuditLogs);
  const logs = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => listFn({ data: undefined }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="A record of what happened at this counter, newest first."
      />

      <Panel flush>
        {logs.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-9 rounded-lg" />
            ))}
          </div>
        ) : (logs.data?.logs.length ?? 0) === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Activity shows up as soon as your counter starts taking jobs."
          />
        ) : (
          <ul className="divide-y divide-border">
            {logs.data?.logs.map(
              (log: { id: string; actor: string | null; action: string; created_at: string }) => (
                <li key={log.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {log.actor === "demo-agent" ? "Demo Print Agent" : (log.actor ?? "system")}
                  </span>
                  <span className="w-44 text-right text-xs tabular-nums text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </Panel>
    </div>
  );
}
