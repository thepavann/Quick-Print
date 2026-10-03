import { Printer } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
  showWordmark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}) {
  const box = size === "lg" ? "size-10 rounded-xl" : size === "sm" ? "size-6 rounded-md" : "size-8 rounded-lg";
  const icon = size === "lg" ? "size-5" : size === "sm" ? "size-3.5" : "size-4";
  const text = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-[0.95rem]";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid place-items-center bg-primary text-primary-foreground shadow-xs-soft",
          box,
        )}
      >
        <Printer className={icon} strokeWidth={2.2} />
      </span>
      {showWordmark ? (
        <span className={cn("font-semibold tracking-tight text-foreground", text)}>QuickPrint</span>
      ) : null}
    </span>
  );
}

export function StatusDot({
  tone = "muted",
  pulse = false,
  className,
}: {
  tone?: "online" | "offline" | "busy" | "muted";
  pulse?: boolean;
  className?: string;
}) {
  const color =
    tone === "online"
      ? "bg-success"
      : tone === "offline"
        ? "bg-destructive"
        : tone === "busy"
          ? "bg-warning"
          : "bg-muted-foreground/50";

  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)}>
      {pulse ? (
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", color)} />
      ) : null}
      <span className={cn("relative size-2 rounded-full", color)} />
    </span>
  );
}
