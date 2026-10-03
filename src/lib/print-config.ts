/**
 * Browser-safe shared domain helpers for the print workflow.
 * Imported by both client components and server functions — no secrets here.
 */

export type PaperSize = "A4" | "A3";
export type ColorMode = "BW" | "COLOR";
export type JobStatus =
  | "QUEUED"
  | "DOWNLOADING"
  | "PRINTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export const MAX_COPIES = 20;
export const DEFAULT_MAX_FILE_MB = 10;

export interface PrintOptions {
  copies: number;
  color: ColorMode;
  duplex: boolean;
  paper: PaperSize;
  pageRange: string | null;
}

export interface PricingRule {
  paper: PaperSize;
  color: ColorMode;
  duplex: boolean;
  price_per_page: number;
}

export const PRICING_MATRIX: Array<{
  paper: PaperSize;
  color: ColorMode;
  duplex: boolean;
  label: string;
}> = [
  { paper: "A4", color: "BW", duplex: false, label: "B&W Single" },
  { paper: "A4", color: "BW", duplex: true, label: "B&W Double" },
  { paper: "A4", color: "COLOR", duplex: false, label: "Color Single" },
  { paper: "A4", color: "COLOR", duplex: true, label: "Color Double" },
  { paper: "A3", color: "BW", duplex: false, label: "B&W Single" },
  { paper: "A3", color: "BW", duplex: true, label: "B&W Double" },
  { paper: "A3", color: "COLOR", duplex: false, label: "Color Single" },
  { paper: "A3", color: "COLOR", duplex: true, label: "Color Double" },
];

/** Parses "1-5, 8, 10-12" into a de-duplicated, sorted page list. Throws on invalid input. */
export function parsePageRange(range: string, pageCount: number): number[] {
  const cleaned = range.trim();
  if (!cleaned) throw new Error("Enter a page range, for example 1-5, 8, 10-12.");

  const pages = new Set<number>();
  for (const part of cleaned.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!match) throw new Error(`"${token}" is not a valid page or range.`);
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < 1) throw new Error("Pages start at 1.");
    if (end < start) throw new Error(`"${token}" ends before it starts.`);
    if (end > pageCount) throw new Error(`This document has only ${pageCount} pages.`);
    for (let page = start; page <= end; page += 1) pages.add(page);
  }

  if (pages.size === 0) throw new Error("Enter at least one page.");
  return [...pages].sort((a, b) => a - b);
}

/** Number of sheets/pages actually billed for a job. */
export function billedPages(pageCount: number, pageRange: string | null): number {
  if (!pageRange) return pageCount;
  return parsePageRange(pageRange, pageCount).length;
}

export function findRule(rules: PricingRule[], options: Pick<PrintOptions, "paper" | "color" | "duplex">) {
  return rules.find(
    (rule) =>
      rule.paper === options.paper && rule.color === options.color && rule.duplex === options.duplex,
  );
}

/**
 * The canonical price formula. The browser uses it for an instant estimate;
 * the server recomputes it from database pricing before a job is accepted.
 */
export function calculateAmount(args: {
  pageCount: number;
  options: PrintOptions;
  rules: PricingRule[];
}): number {
  const rule = findRule(args.rules, args.options);
  if (!rule) throw new Error("This combination is not available at this counter.");
  const pages = billedPages(args.pageCount, args.options.pageRange);
  const amount = pages * args.options.copies * Number(rule.price_per_page);
  return Math.round(amount * 100) / 100;
}

export function formatMoney(amount: number): string {
  const rounded = Math.round(Number(amount) * 100) / 100;
  return `₹${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function jobLabel(jobNumber: number): string {
  return `QP-${jobNumber}`;
}

export function optionsSummary(job: {
  color: ColorMode;
  duplex: boolean;
  paper: PaperSize;
}): string {
  return [
    job.color === "BW" ? "B&W" : "Color",
    job.duplex ? "Double-sided" : "Single-sided",
    job.paper,
  ].join(" · ");
}
