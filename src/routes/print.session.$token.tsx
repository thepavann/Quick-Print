import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Logo, StatusDot } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_COPIES,
  billedPages,
  calculateAmount,
  formatBytes,
  formatMoney,
  parsePageRange,
  type ColorMode,
  type PaperSize,
} from "@/lib/print-config";
import {
  analyzeDocument,
  createUploadTarget,
  submitPrintJob,
  validateSession,
} from "@/lib/print.functions";
import { cn } from "@/lib/utils";
import {
  IMAGE_LAYOUTS,
  detectKind,
  docxToPdf,
  imagesToPdf,
  type ImageFit,
  type ImageLayoutId,
} from "@/lib/convert-to-pdf";

/** A per-phone secret that proves this device was the one that scanned the QR first. */
function getClaim(token: string): string {
  const key = `qp-claim-${token}`;
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    window.localStorage.setItem(key, value);
  }
  return value;
}

export const Route = createFileRoute("/print/session/$token")({
  head: () => ({
    meta: [
      { title: "Upload your PDF · QuickPrint" },
      {
        name: "description",
        content:
          "Upload a PDF, choose copies, colour, sides and paper size, see the price instantly and send the job to the stationery counter's printer.",
      },
      { property: "og:title", content: "Upload your PDF · QuickPrint" },
      {
        property: "og:description",
        content: "Scan, upload, choose your options and collect your prints at the counter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrintSessionPage,
});

const BUCKET = "print-files";

type Uploaded = { path: string; filename: string; size: number; pageCount: number };

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-1 rounded-xl border border-border bg-surface-muted p-1"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              "disabled:cursor-not-allowed disabled:opacity-40",
              value === option.value
                ? "bg-surface text-foreground shadow-xs-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrintSessionPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  const validate = useServerFn(validateSession);
  const requestUpload = useServerFn(createUploadTarget);
  const analyze = useServerFn(analyzeDocument);
  const submit = useServerFn(submitPrintJob);

  const { data, isPending, refetch } = useQuery({
    queryKey: ["print-session", token],
    queryFn: () => validate({ data: { token, claim: getClaim(token) } }),
    refetchInterval: 15000,
  });

  const [file, setFile] = useState<Uploaded | null>(null);
  const [stage, setStage] = useState<"idle" | "converting" | "uploading" | "analyzing" | "submitting">("idle");
  const [photos, setPhotos] = useState<File[] | null>(null);
  const [layout, setLayout] = useState<ImageLayoutId>("1");
  const [fit, setFit] = useState<ImageFit>("fit");
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState<ColorMode>("BW");
  const [duplex, setDuplex] = useState(false);
  const [paper, setPaper] = useState<PaperSize>("A4");
  const [rangeMode, setRangeMode] = useState<"ALL" | "CUSTOM">("ALL");
  const [pageRange, setPageRange] = useState("");
  const [remaining, setRemaining] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const station = data?.ok ? data.station : null;
  const expiresAt = data?.ok ? data.expiresAt : undefined;

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (station && !station.a4Enabled && station.a3Enabled) setPaper("A3");
  }, [station]);

  const rangeError = useMemo(() => {
    if (rangeMode === "ALL" || !file) return null;
    try {
      parsePageRange(pageRange, file.pageCount);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid page range.";
    }
  }, [rangeMode, pageRange, file]);

  const effectiveRange = rangeMode === "CUSTOM" && !rangeError ? pageRange.trim() : null;
  const pages = file ? billedPages(file.pageCount, effectiveRange) : 0;
  const estimate =
    file && data?.ok
      ? calculateAmount({
          rules: data.rules,
          pageCount: file.pageCount,
          options: { copies, color, duplex, paper, pageRange: effectiveRange },
        })
      : 0;

  const sessionExpired = remaining <= 0;

  async function handleFiles(list: File[]) {
    if (list.length === 0) return;
    const kinds = list.map(detectKind);
    if (kinds.every((k) => k === "image")) {
      setPhotos((prev) => [...(prev ?? []), ...list].slice(0, 60));
      setFile(null);
      return;
    }
    const first = list[0]!;
    const kind = kinds[0];
    if (kind === "pdf") return uploadPdf(first);
    if (kind === "docx") {
      setStage("converting");
      try {
        const pdf = await docxToPdf(first, paper);
        await uploadPdf(pdf);
      } catch {
        toast.error("We couldn't read that Word file. Try saving it as PDF.");
        setStage("idle");
      }
      return;
    }
    if (first.name.toLowerCase().match(/\.(pptx?|doc|xlsx?)$/)) {
      toast.error("This file type can't be converted on your phone yet. Please save it as PDF first.");
      return;
    }
    toast.error("Choose a PDF, Word (.docx) file or photos.");
  }

  async function buildPhotoPdf() {
    if (!photos) return;
    setStage("converting");
    try {
      const pdf = await imagesToPdf(photos, { layout, fit, paper });
      await uploadPdf(pdf);
    } catch {
      toast.error("We couldn't prepare those photos. Please try again.");
      setStage("idle");
    }
  }

  async function uploadPdf(selected: File) {
    const limitMb = station?.maxFileSizeMb ?? 10;
    if (selected.size > limitMb * 1024 * 1024) {
      toast.error(`That file is larger than ${limitMb} MB.`);
      return;
    }

    setStage("uploading");
    try {
      const target = await requestUpload({
        data: { token, claim: getClaim(token), filename: selected.name, size: selected.size },
      });
      if (!target.ok) {
        toast.error(
          target.reason === "TOO_LARGE"
            ? `That file is larger than ${limitMb} MB.`
            : target.reason === "NOT_PDF"
              ? "Please choose a PDF file."
              : "This print session is no longer valid.",
        );
        setStage("idle");
        void refetch();
        return;
      }

      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(target.path, target.uploadToken, selected, {
          contentType: "application/pdf",
        });
      if (error) throw error;

      setStage("analyzing");
      const analyzed = await analyze({ data: { token, claim: getClaim(token), path: target.path } });
      if (!analyzed.ok) {
        toast.error("We couldn't read that PDF. Try another file.");
        setStage("idle");
        return;
      }

      setFile({
        path: target.path,
        filename: selected.name,
        size: selected.size,
        pageCount: analyzed.pageCount,
      });
      setStage("idle");
    } catch {
      toast.error("Upload failed. Please try again.");
      setStage("idle");
    }
  }

  async function handleSubmit() {
    if (!file || rangeError) return;
    setStage("submitting");
    try {
      const result = await submit({
        data: {
          token,
          claim: getClaim(token),
          path: file.path,
          filename: file.filename,
          options: { copies, color, duplex, paper, pageRange: effectiveRange },
          idempotencyKey,
        },
      });

      if (!result.ok) {
        const message =
          result.reason === "EXPIRED"
            ? "This QR session has expired. Please scan the latest QR displayed at the stationery."
            : result.reason === "LIMIT_REACHED"
              ? "This QR session has reached its job limit. Please scan the latest QR."
              : result.reason === "OPTION_UNAVAILABLE"
                ? "That combination isn't available at this counter."
                : result.reason === "BAD_RANGE"
                  ? "Please check your page range."
                  : "This print session is no longer valid.";
        toast.error(message);
        setStage("idle");
        void refetch();
        return;
      }

      await navigate({ to: "/print/job/$jobId", params: { jobId: result.jobId } });
    } catch {
      toast.error("We couldn't submit your job. Please try again.");
      setStage("idle");
    }
  }

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-muted/50">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Preparing your print session...
        </div>
      </div>
    );
  }

  if (!data?.ok) {
    const expiredSession = data?.reason === "EXPIRED" || data?.reason === "LIMIT_REACHED";
    return (
      <div className="grid min-h-screen place-items-center bg-surface-muted/50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-soft">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-warning-soft">
            <RefreshCw className="size-5 text-[oklch(0.5_0.12_72)]" />
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
            {expiredSession ? "Session expired" : "Session not valid"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {expiredSession
              ? "This QR session has expired. Please scan the latest QR displayed at the stationery."
              : "This print session is no longer valid."}
          </p>
        </div>
      </div>
    );
  }

  const busy = stage !== "idle";

  return (
    <div className="min-h-screen bg-surface-muted/50 pb-40">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 px-5 py-3.5 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
          <Logo size="sm" />
          <div className="flex items-center gap-2 text-right">
            <StatusDot tone={sessionExpired ? "offline" : "online"} pulse={!sessionExpired} />
            <div>
              <p className="text-xs font-medium leading-tight text-foreground">Session active</p>
              <p className="text-[11px] leading-tight text-muted-foreground tabular">
                Expires in {remaining}s
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4 px-5 pt-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {data.station.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a PDF and collect your prints at the counter.
          </p>
        </div>

        {!data.printerOnline ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3.5">
            <WifiOff className="mt-0.5 size-4 shrink-0 text-[oklch(0.5_0.12_72)]" />
            <p className="text-xs leading-relaxed text-[oklch(0.42_0.1_72)]">
              Printer is currently offline. Your job will remain queued.
            </p>
          </div>
        ) : null}

        {/* Upload */}
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-xs-soft">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              event.target.value = "";
              void handleFiles(selected);
            }}
          />

          {photos && !file ? (
            <PhotoLayoutPicker
              photos={photos}
              layout={layout}
              fit={fit}
              busy={busy}
              stage={stage}
              onLayout={setLayout}
              onFit={setFit}
              onCancel={() => setPhotos(null)}
              onAddMore={() => inputRef.current?.click()}
              onConfirm={() => void buildPhotoPdf()}
            />
          ) : file ? (
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.filename}</p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular">
                  {file.pageCount} pages · {formatBytes(file.size)}
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-brand underline-offset-4 hover:underline"
                  onClick={() => (photos ? setFile(null) : inputRef.current?.click())}
                >
                  {photos ? "Change photo layout" : "Replace file"}
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove file"
                onClick={() => {
                  setFile(null);
                  setPhotos(null);
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || sessionExpired}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleFiles(Array.from(event.dataTransfer.files ?? []));
              }}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-muted px-6 py-10 text-center transition-colors hover:border-brand/50 hover:bg-brand-soft/40 disabled:opacity-60"
            >
              <span className="grid size-12 place-items-center rounded-full border border-border bg-surface text-muted-foreground shadow-xs-soft">
                {stage === "uploading" || stage === "analyzing" || stage === "converting" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Upload className="size-5" />
                )}
              </span>
              <span className="text-sm font-medium text-foreground">
                {stage === "converting"
                  ? "Preparing pages..."
                  : stage === "uploading"
                  ? "Uploading..."
                  : stage === "analyzing"
                    ? "Analyzing document..."
                    : "Choose file or photos"}
              </span>
              <span className="text-xs text-muted-foreground">
                PDF, Word (.docx) or photos · up to {data.station.maxFileSizeMb} MB
              </span>
            </button>
          )}
        </section>

        {file ? (
          <>
            <section className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-xs-soft">
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Copies</p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Fewer copies"
                    disabled={copies <= 1}
                    onClick={() => setCopies((value) => Math.max(1, value - 1))}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="min-w-10 text-center text-lg font-semibold tabular text-foreground">
                    {copies}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="More copies"
                    disabled={copies >= MAX_COPIES}
                    onClick={() => setCopies((value) => Math.min(MAX_COPIES, value + 1))}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <SegmentedControl
                label="Print type"
                value={color}
                onChange={setColor}
                options={[
                  { value: "BW" as ColorMode, label: "Black & White" },
                  { value: "COLOR" as ColorMode, label: "Colour", disabled: !data.station.colorEnabled },
                ]}
              />

              <SegmentedControl
                label="Sides"
                value={duplex ? "DUPLEX" : "SINGLE"}
                onChange={(value) => setDuplex(value === "DUPLEX")}
                options={[
                  { value: "SINGLE", label: "Single-sided" },
                  { value: "DUPLEX", label: "Double-sided", disabled: !data.station.duplexEnabled },
                ]}
              />

              <SegmentedControl
                label="Paper size"
                value={paper}
                onChange={setPaper}
                options={[
                  { value: "A4" as PaperSize, label: "A4", disabled: !data.station.a4Enabled },
                  { value: "A3" as PaperSize, label: "A3", disabled: !data.station.a3Enabled },
                ]}
              />

              <div>
                <SegmentedControl
                  label="Pages"
                  value={rangeMode}
                  onChange={setRangeMode}
                  options={[
                    { value: "ALL" as const, label: "All pages" },
                    { value: "CUSTOM" as const, label: "Custom range" },
                  ]}
                />
                {rangeMode === "CUSTOM" ? (
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="range">Page range</Label>
                    <Input
                      id="range"
                      inputMode="numeric"
                      value={pageRange}
                      onChange={(event) => setPageRange(event.target.value)}
                      placeholder="Example: 1-5, 8, 10-12"
                      aria-invalid={Boolean(rangeError)}
                    />
                    {rangeError ? (
                      <p className="text-xs text-destructive">{rangeError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Example: 1-5, 8, 10-12 · this document has {file.pageCount} pages
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4 shadow-xs-soft">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                {[
                  ["Document", file.filename],
                  ["Pages", `${pages} × ${copies} ${copies === 1 ? "copy" : "copies"}`],
                  ["Print type", color === "COLOR" ? "Colour" : "Black & White"],
                  ["Sides", duplex ? "Double-sided" : "Single-sided"],
                  ["Paper", paper],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-6">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="truncate text-right font-medium text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-xl font-semibold tabular text-foreground">
                  {formatMoney(estimate)}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Final amount is confirmed by the counter when the job is accepted.
              </p>
            </section>
          </>
        ) : null}
      </main>

      {file ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-5 py-4 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-lg">
            <p className="mb-2.5 text-center text-xs text-muted-foreground">
              You will be asked to pay{" "}
              <span className="font-medium text-foreground tabular">{formatMoney(estimate)}</span>{" "}
              at the counter for this print job.
            </p>
            <Button
              className="h-12 w-full text-[0.95rem]"
              disabled={busy || sessionExpired || Boolean(rangeError)}
              onClick={handleSubmit}
            >
              {stage === "submitting" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {sessionExpired ? "Session expired — rescan the QR" : "Submit Print Job"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LayoutDiagram({ cols, rows, passport }: { cols: number; rows: number; passport?: boolean }) {
  return (
    <div className="mx-auto grid aspect-[1/1.414] w-10 gap-[2px] rounded-[3px] border border-border-strong bg-surface p-[3px]"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: passport ? `repeat(${rows}, 0.9fr) 1fr` : `repeat(${rows}, 1fr)` }}
    >
      {Array.from({ length: cols * rows }, (_, i) => (
        <span key={i} className="rounded-[1px] bg-brand/35" />
      ))}
    </div>
  );
}

function PhotoLayoutPicker(props: {
  photos: File[];
  layout: ImageLayoutId;
  fit: ImageFit;
  busy: boolean;
  stage: string;
  onLayout: (id: ImageLayoutId) => void;
  onFit: (fit: ImageFit) => void;
  onCancel: () => void;
  onAddMore: () => void;
  onConfirm: () => void;
}) {
  const { photos, layout } = props;
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = photos.map((p) => URL.createObjectURL(p));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  const selected = IMAGE_LAYOUTS.find((l) => l.id === layout)!;
  const sheets = selected.passport
    ? photos.length
    : Math.ceil(photos.length / (selected.cols * selected.rows));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {photos.length} {photos.length === 1 ? "photo" : "photos"}
        </p>
        <div className="flex gap-3 text-xs font-medium">
          <button type="button" className="text-brand" onClick={props.onAddMore} disabled={props.busy}>
            Add more
          </button>
          <button type="button" className="text-muted-foreground" onClick={props.onCancel} disabled={props.busy}>
            Clear
          </button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {urls.map((url, i) => (
          <img key={url} src={url} alt={`Photo ${i + 1}`} className="size-14 shrink-0 rounded-lg border border-border object-cover" />
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Layout</p>
        <div role="radiogroup" aria-label="Layout" className="grid grid-cols-4 gap-2">
          {IMAGE_LAYOUTS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={layout === option.id}
              onClick={() => props.onLayout(option.id)}
              className={cn(
                "rounded-xl border px-1.5 py-2.5 text-center transition-all",
                layout === option.id
                  ? "border-brand bg-brand-soft/60 shadow-xs-soft"
                  : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <LayoutDiagram cols={option.cols} rows={option.rows} passport={option.passport ?? false} />
              <span className="mt-1.5 block text-[11px] font-medium leading-tight text-foreground">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {selected.hint} · {sheets} {sheets === 1 ? "sheet" : "sheets"}
        </p>
      </div>

      {!selected.passport ? (
        <SegmentedControl
          label="Photo fit"
          value={props.fit}
          onChange={props.onFit}
          options={[
            { value: "fit" as ImageFit, label: "Show whole photo" },
            { value: "fill" as ImageFit, label: "Fill the box" },
          ]}
        />
      ) : null}

      <Button className="h-11 w-full" disabled={props.busy} onClick={props.onConfirm}>
        {props.busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {props.stage === "converting" ? "Preparing pages..." : props.busy ? "Uploading..." : "Use this layout"}
      </Button>
    </div>
  );
}
