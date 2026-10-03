/**
 * Print Jobs: filterable, searchable table of every job at this station, with
 * cancel and Demo Print Agent controls.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Search, TriangleAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DemoBadge,
  EmptyState,
  JobStatusBadge,
  PageHeader,
  Panel,
} from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, jobLabel, optionsSummary } from "@/lib/print-config";
import { advanceDemoJob, cancelPrintJob, listPrintJobs } from "@/lib/station.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/jobs")({
  component: JobsPage,
});

const FILTERS = ["ALL", "QUEUED", "DOWNLOADING", "PRINTING", "COMPLETED", "FAILED"] as const;
type Filter = (typeof FILTERS)[number];

interface JobRow {
  id: string;
  job_number: number;
  filename: string;
  page_count: number;
  printed_pages: number;
  copies: number;
  color: "BW" | "COLOR";
  duplex: boolean;
  paper: "A4" | "A3";
  page_range: string | null;
  amount: number;
  status: string;
  error_message: string | null;
  created_at: string;
  demo: boolean;
}

function JobsPage() {
  const [status, setStatus] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [openJob, setOpenJob] = useState<string | null>(null);

  const listFn = useServerFn(listPrintJobs);
  const advanceFn = useServerFn(advanceDemoJob);
  const cancelFn = useServerFn(cancelPrintJob);
  const queryClient = useQueryClient();

  const jobs = useQuery({
    queryKey: ["print-jobs", status, search],
    queryFn: () => listFn({ data: { status, search, limit: 100 } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
    void queryClient.invalidateQueries({ queryKey: ["overview"] });
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

  const rows = (jobs.data?.jobs ?? []) as JobRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Print jobs"
        description="Every job submitted at this counter, newest first."
        action={<DemoBadge />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 shadow-xs-soft">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setStatus(filter)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                status === filter
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter === "ALL" ? "All" : filter.toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search job ID or filename"
            className="rounded-lg pl-9"
          />
        </div>
      </div>

      <Panel flush>
        {jobs.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No jobs match this view"
            description="Try a different status filter or clear the search."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Job ID</th>
                  <th className="px-3 py-3 font-medium">Document</th>
                  <th className="px-3 py-3 font-medium">Pages</th>
                  <th className="px-3 py-3 font-medium">Copies</th>
                  <th className="px-3 py-3 font-medium">Options</th>
                  <th className="px-3 py-3 text-right font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((job) => (
                  <>
                    <tr
                      key={job.id}
                      onClick={() => setOpenJob(openJob === job.id ? null : job.id)}
                      className="cursor-pointer transition-colors hover:bg-accent/50"
                    >
                      <td className="px-5 py-3 tabular-nums font-medium">{jobLabel(job.job_number)}</td>
                      <td className="max-w-[14rem] truncate px-3 py-3 text-muted-foreground">
                        {job.filename}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{job.printed_pages}</td>
                      <td className="px-3 py-3 tabular-nums">{job.copies}</td>
                      <td className="px-3 py-3 text-muted-foreground">{optionsSummary(job)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatMoney(job.amount)}</td>
                      <td className="px-3 py-3">
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {["QUEUED", "DOWNLOADING", "PRINTING"].includes(job.status) ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                disabled={advance.isPending}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  advance.mutate({ jobId: job.id, outcome: "ADVANCE" });
                                }}
                              >
                                <Play className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-lg text-muted-foreground"
                                disabled={cancel.isPending}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  cancel.mutate(job.id);
                                }}
                              >
                                <XCircle className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {openJob === job.id ? (
                      <tr key={`${job.id}-detail`} className="bg-muted/30">
                        <td colSpan={9} className="px-5 py-4">
                          <div className="grid gap-3 text-xs sm:grid-cols-3">
                            <Detail label="Document pages">{job.page_count}</Detail>
                            <Detail label="Printed pages">{job.printed_pages}</Detail>
                            <Detail label="Page range">{job.page_range ?? "All pages"}</Detail>
                            <Detail label="Paper">{job.paper}</Detail>
                            <Detail label="Colour">{job.color === "BW" ? "B&W" : "Colour"}</Detail>
                            <Detail label="Sides">{job.duplex ? "Double-sided" : "Single-sided"}</Detail>
                            <Detail label="Payment">Cash at counter</Detail>
                            <Detail label="Run type">{job.demo ? "Demo run" : "Physical print"}</Detail>
                            <Detail label="Amount">{formatMoney(job.amount)}</Detail>
                          </div>
                          {job.error_message ? (
                            <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                              {job.error_message}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{children}</p>
    </div>
  );
}
