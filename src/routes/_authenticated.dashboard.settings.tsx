/**
 * Settings: station identity, session rules and the upload size limit students get.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader, Panel, SaveButton } from "@/components/dashboard/shell";
import { useStationContext } from "@/components/dashboard/use-station";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { saveStationSettings } from "@/lib/station.functions";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data, isLoading } = useStationContext();
  const saveFn = useServerFn(saveStationSettings);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    location: "",
    session_duration_seconds: 60,
    max_jobs_per_session: 3,
    max_file_size_mb: 10,
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.station.name,
      location: data.station.location ?? "",
      session_duration_seconds: data.station.session_duration_seconds,
      max_jobs_per_session: data.station.max_jobs_per_session,
      max_file_size_mb: data.station.max_file_size_mb,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          name: form.name,
          location: form.location.trim() ? form.location.trim() : null,
          session_duration_seconds: form.session_duration_seconds,
          max_jobs_per_session: form.max_jobs_per_session,
          max_file_size_mb: form.max_file_size_mb,
        },
      }),
    onSuccess: () => {
      toast.success("Settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["station-context"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="How your counter appears and behaves for students." />

      {isLoading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : (
        <form
          className="grid gap-4 lg:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Panel title="Station" description="Shown on the counter display and student screens">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="station-name">Station name</Label>
                <Input
                  id="station-name"
                  value={form.name}
                  onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                  className="rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="station-location">Location</Label>
                <Input
                  id="station-location"
                  value={form.location}
                  onChange={(event) => setForm((f) => ({ ...f, location: event.target.value }))}
                  placeholder="Main gate, ground floor"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="file-size">Maximum PDF size (MB)</Label>
                <Input
                  id="file-size"
                  type="number"
                  min={1}
                  max={50}
                  value={form.max_file_size_mb}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, max_file_size_mb: Number(event.target.value) }))
                  }
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">PDF files only. Default 10 MB.</p>
              </div>
            </div>
          </Panel>

          <Panel title="Scan rules" description="Also editable from the QR display page">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="duration">QR refresh (seconds)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={20}
                  max={300}
                  value={form.session_duration_seconds}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, session_duration_seconds: Number(event.target.value) }))
                  }
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-jobs">Documents per scan</Label>
                <Input
                  id="max-jobs"
                  type="number"
                  min={1}
                  max={20}
                  value={form.max_jobs_per_session}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, max_jobs_per_session: Number(event.target.value) }))
                  }
                  className="rounded-lg"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Payment is collected in cash at the counter. Online payment isn't part of this version.
              </p>
            </div>
          </Panel>

          <div className="lg:col-span-2">
            <SaveButton pending={save.isPending} />
          </div>
        </form>
      )}
    </div>
  );
}
