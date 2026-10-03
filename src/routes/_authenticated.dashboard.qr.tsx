/**
 * QR Display management: current rotating session, fullscreen counter display link
 * and the session rules (refresh duration, jobs per scan).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/brand";
import { PageHeader, Panel, SaveButton } from "@/components/dashboard/shell";
import { useStationContext } from "@/components/dashboard/use-station";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStationSettings } from "@/lib/station.functions";

export const Route = createFileRoute("/_authenticated/dashboard/qr")({
  component: QrPage,
});

function QrPage() {
  const { data } = useStationContext();
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveStationSettings);

  const [duration, setDuration] = useState(60);
  const [maxJobs, setMaxJobs] = useState(3);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!data) return;
    setDuration(data.station.session_duration_seconds);
    setMaxJobs(data.station.max_jobs_per_session);
  }, [data]);

  const expiresAt = data?.session?.expires_at ?? null;
  useEffect(() => {
    if (!expiresAt) {
      setRemaining(0);
      return;
    }
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          name: data!.station.name,
          location: data!.station.location,
          session_duration_seconds: duration,
          max_jobs_per_session: maxJobs,
          max_file_size_mb: data!.station.max_file_size_mb,
        },
      }),
    onSuccess: () => {
      toast.success("QR session rules saved.");
      void queryClient.invalidateQueries({ queryKey: ["station-context"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const displayUrl = data ? `/station/${data.station.id}/display` : "#";

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR display"
        description="The counter screen shows a one-scan QR code. It changes the moment a student scans it, so a photographed code can't be reused."
        action={
          <Button asChild className="rounded-lg" disabled={!data}>
            <a href={displayUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Open fullscreen display
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Current session" description="Rotates on its own while the display is open">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="inline-flex items-center gap-1.5 font-medium">
                <StatusDot tone={remaining > 0 ? "online" : "muted"} pulse={remaining > 0} />
                {remaining > 0 ? "Active" : "Waiting for the display"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Expires in</dt>
              <dd className="font-medium tabular-nums">{remaining > 0 ? `${remaining}s` : "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Jobs used this scan</dt>
              <dd className="font-medium tabular-nums">
                {data?.session ? `${data.session.jobs_used} / ${data.session.max_jobs}` : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            <ul className="space-y-1">
              <li>Expired links are rejected by the server, not just hidden in the page.</li>
              <li>Each code works for one phone only, then a new code appears.</li>
              <li>Each scan is limited to the number of jobs you set below.</li>
              <li>The QR only carries a short-lived link — never printer or account details.</li>
            </ul>
          </div>
        </Panel>

        <Panel title="Session rules" description="Applies to the next refresh">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="duration">Session duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                min={20}
                max={300}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">Between 20 and 300 seconds. Default 60.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxJobs">Max jobs per scan</Label>
              <Input
                id="maxJobs"
                type="number"
                min={1}
                max={20}
                value={maxJobs}
                onChange={(event) => setMaxJobs(Number(event.target.value))}
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">Default 3 documents per scan.</p>
            </div>

            <SaveButton pending={save.isPending} />
          </form>
        </Panel>
      </div>
    </div>
  );
}
