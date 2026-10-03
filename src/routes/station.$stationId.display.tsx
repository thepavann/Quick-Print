import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, ShieldCheck, Timer } from "lucide-react";

import { Logo, StatusDot } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getStationSession } from "@/lib/print.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/station/$stationId/display")({
  head: () => ({
    meta: [
      { title: "Counter display · QuickPrint" },
      {
        name: "description",
        content:
          "Full-screen counter display showing a QuickPrint QR code that changes after every scan so print jobs can only be submitted at the counter.",
      },
      { property: "og:title", content: "Counter display · QuickPrint" },
      {
        property: "og:description",
        content: "A one-scan QR code, shown on the stationery counter screen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StationDisplay,
});

function QrCanvas({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("qrcode").then(async (mod) => {
      const generated = await mod.toDataURL(url, {
        margin: 1,
        width: 1024,
        errorCorrectionLevel: "M",
        color: { dark: "#101828", light: "#ffffff" },
      });
      if (!cancelled) {
        previous.current = generated;
        setDataUrl(generated);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const src = dataUrl ?? previous.current;

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-white p-3 shadow-soft sm:p-5">
      {src ? (
        <img
          key={src}
          src={src}
          alt="Scan this QR code to start a print session"
          className="size-full animate-in fade-in duration-500"
        />
      ) : (
        <div className="grid size-full place-items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function StationDisplay() {
  const { stationId } = Route.useParams();
  const fetchSession = useServerFn(getStationSession);

  const { data, isPending } = useQuery({
    queryKey: ["station-session", stationId],
    queryFn: () => fetchSession({ data: { stationId } }),
    refetchInterval: 2000,
    staleTime: 0,
  });

  const session = data?.ok ? data.session : undefined;
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [session?.expiresAt]);

  const printUrl = useMemo(() => {
    if (!session || typeof window === "undefined") return "";

    // The QR must point to an address the student's phone can reach.
    // VITE_PUBLIC_APP_URL is useful when the counter display is opened from
    // localhost or another address that is not reachable from the student's phone.
    const configuredBase = import.meta.env["VITE_PUBLIC_APP_URL"]?.trim();
    const base = (configuredBase || window.location.origin).replace(/\/$/, "");
    return `${base}/print/session/${encodeURIComponent(session.token)}`;
  }, [session]);


  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Preparing your print session...
        </div>
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">Station not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This display link doesn't match any stationery counter.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted/60">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface/80 px-5 py-4 backdrop-blur-xl sm:px-10">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden h-5 w-px bg-border sm:block" />
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-tight text-foreground">
              {data.station.name}
            </p>
            {data.station.location ? (
              <p className="text-xs text-muted-foreground">{data.station.location}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            <StatusDot tone={data.printer.online ? "online" : "offline"} pulse={data.printer.online} />
            {data.printer.online ? "Printer online" : "Printer offline"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open full screen"
            onClick={() => void document.documentElement.requestFullscreen?.()}
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 px-5 py-10 sm:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Scan to Print
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Point your phone camera at the code below to start a print session.
          </p>
        </div>

        <div className="w-full max-w-[min(72vh,26rem)]">
          <QrCanvas url={printUrl} />
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-xs-soft">
          <StatusDot tone="online" pulse />
          One scan per code · a new code appears after each scan
        </div>

        <div className="max-w-lg space-y-3 text-center">
          <p className="text-sm font-medium text-foreground">
            Only scan the QR displayed at the stationery counter.
          </p>
          <p className="flex items-start justify-center gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand" />
            Each code works for one phone only and changes right after it is scanned, so a photo of the code can't be used later.
          </p>
        </div>
      </main>
    </div>
  );
}
