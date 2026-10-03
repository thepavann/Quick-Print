/**
 * Shared dashboard chrome: sticky sidebar, top bar, and the small presentational
 * primitives (stat tiles, status pills, section headers, empty states) that keep
 * every counter page visually consistent.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Gauge,
  History,
  LogOut,
  Printer as PrinterIcon,
  QrCode,
  ReceiptIndianRupee,
  Settings,
  Files,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Logo, StatusDot } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { JobStatus } from "@/lib/print-config";
import { cn } from "@/lib/utils";

export const DASHBOARD_NAV = [
  { to: "/dashboard", label: "Overview", icon: Gauge, exact: true },
  { to: "/dashboard/jobs", label: "Print Jobs", icon: Files },
  { to: "/dashboard/qr", label: "QR Display", icon: QrCode },
  { to: "/dashboard/printer", label: "Printer", icon: PrinterIcon },
  { to: "/dashboard/pricing", label: "Pricing", icon: ReceiptIndianRupee },
  { to: "/dashboard/history", label: "History", icon: History },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    await navigate({ to: "/login" });
  }

  return (
    <div className="flex h-full flex-col gap-1 border-r border-border bg-sidebar px-3 py-4">
      <div className="px-2 pb-4">
        <Logo size="sm" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {DASHBOARD_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            activeOptions={{ exact: "exact" in item ? item.exact : false }}
            className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
          >
            <item.icon className="size-4 shrink-0 opacity-80" strokeWidth={2} />
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        onClick={signOut}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <LogOut className="size-4 shrink-0 opacity-80" strokeWidth={2} />
        Sign out
      </button>
    </div>
  );
}

export function DashboardTopBar({
  title,
  stationName,
  right,
  onOpenNav,
}: {
  title: string;
  stationName?: string | undefined;
  right?: ReactNode | undefined;
  onOpenNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-8">
      <button
        onClick={onOpenNav}
        className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-4" />
      </button>
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {stationName ? (
          <>
            <span className="truncate font-medium text-foreground">{stationName}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
          </>
        ) : null}
        <span className="truncate text-muted-foreground">{title}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-64 animate-in slide-in-from-left duration-200">
        <button
          onClick={onClose}
          className="absolute right-2 top-3 z-10 grid size-8 place-items-center rounded-lg text-muted-foreground"
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </button>
        <DashboardSidebar onNavigate={onClose} />
      </div>
    </div>
  );
}

export function useMobileNav() {
  const [open, setOpen] = useState(false);
  return { open, openNav: () => setOpen(true), closeNav: () => setOpen(false) };
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  className,
  children,
  flush = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-xs-soft transition-shadow",
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: typeof Gauge;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        {Icon ? <Icon className="size-4 text-muted-foreground/70" strokeWidth={2} /> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const STATUS_STYLES: Record<JobStatus, { label: string; className: string; tone: "online" | "offline" | "busy" | "muted" }> = {
  QUEUED: { label: "Queued", className: "text-muted-foreground border-border bg-muted/50", tone: "muted" },
  DOWNLOADING: { label: "Downloading", className: "text-warning-foreground border-warning/30 bg-warning/10", tone: "busy" },
  PRINTING: { label: "Printing", className: "text-primary border-primary/25 bg-primary/10", tone: "busy" },
  COMPLETED: { label: "Completed", className: "text-success-foreground border-success/30 bg-success/10", tone: "online" },
  FAILED: { label: "Failed", className: "text-destructive border-destructive/30 bg-destructive/10", tone: "offline" },
  CANCELLED: { label: "Cancelled", className: "text-muted-foreground border-border bg-muted/50", tone: "muted" },
};

export function JobStatusBadge({ status }: { status: string }) {
  const meta = STATUS_STYLES[status as JobStatus] ?? STATUS_STYLES.QUEUED;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.className,
      )}
    >
      <StatusDot tone={meta.tone} pulse={meta.tone === "busy"} />
      {meta.label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning-foreground">
      Demo Print Agent
    </span>
  );
}

export function SaveButton({ pending, children = "Save changes" }: { pending: boolean; children?: ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="rounded-lg">
      {pending ? "Saving…" : children}
    </Button>
  );
}
