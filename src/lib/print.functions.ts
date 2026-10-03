/**
 * Public (token-gated) server functions for the counter display and the student
 * print flow. Students have no account: the short-lived QR token is the credential,
 * so every handler re-validates it server-side before doing anything.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  billedPages,
  findRule,
  parsePageRange,
  type ColorMode,
  type PaperSize,
  type PricingRule,
} from "./print-config";

const BUCKET = "print-files";
const HEARTBEAT_GRACE_MS = 90_000;
/** A code nobody has scanned stays on the counter screen this long at most. */
/** After the first scan, that phone has this long to upload and submit. */
const CLAIMED_WINDOW_MS = 15 * 60 * 1000;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const claimSchema = z.string().min(16).max(80);

const optionsSchema = z.object({
  copies: z.number().int().min(1).max(20),
  color: z.enum(["BW", "COLOR"]),
  duplex: z.boolean(),
  paper: z.enum(["A4", "A3"]),
  pageRange: z.string().max(200).nullable(),
});

function randomToken(): string {
  const buffer = new Uint8Array(24);
  crypto.getRandomValues(buffer);
  return [...buffer].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 36);
}

function printerOnline(
  printer: { status: string; last_seen_at: string | null } | null,
  isDemo: boolean,
): boolean {
  if (!printer) return false;
  if (isDemo) return printer.status === "ONLINE";
  if (printer.status !== "ONLINE") return false;
  if (!printer.last_seen_at) return false;
  return Date.now() - new Date(printer.last_seen_at).getTime() < HEARTBEAT_GRACE_MS;
}

/**
 * Returns the station's currently active QR session, rotating it when the previous
 * one has expired. Rotation invalidates every earlier session for the station, so a
 * photographed QR stops working the moment the counter display refreshes.
 */
export const getStationSession = createServerFn({ method: "POST" })
  .inputValidator((input: { stationId: string }) =>
    z.object({ stationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: station } = await supabaseAdmin
      .from("stations")
      .select(
        "id, name, location, is_demo, session_duration_seconds, max_jobs_per_session",
      )
      .eq("id", data.stationId)
      .maybeSingle();

    if (!station) return { ok: false as const, reason: "STATION_NOT_FOUND" as const };

    const { data: printer } = await supabaseAdmin
      .from("printers")
      .select("id, name, status, last_seen_at")
      .eq("station_id", station.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const { data: current } = await supabaseAdmin
      .from("qr_sessions")
      .select("id, token, expires_at, jobs_used, max_jobs")
      .eq("station_id", station.id)
      .eq("status", "ACTIVE")
      .is("claimed_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let session = current;

    if (!session) {
      await supabaseAdmin
        .from("qr_sessions")
        .update({ status: "EXPIRED" })
        .eq("station_id", station.id)
        .eq("status", "ACTIVE")
        .is("claimed_at", null);

      // One-scan codes: an unscanned code stays valid until someone scans it.
      const expiresAt = new Date(Date.now() + station.session_duration_seconds * 1000).toISOString();

      const { data: created, error } = await supabaseAdmin
        .from("qr_sessions")
        .insert({
          station_id: station.id,
          token: randomToken(),
          expires_at: expiresAt,
          max_jobs: station.max_jobs_per_session,
        })
        .select("id, token, expires_at, jobs_used, max_jobs")
        .single();

      if (created) {
        session = created;
        await supabaseAdmin.from("audit_logs").insert({
          station_id: station.id,
          actor: "system",
          action: "qr_session.rotated",
          detail: { session_id: created.id },
        });
      } else if (error?.code === "23505") {
        // Another display request won the race to create the active session.
        // Reuse that session instead of failing one of the displays.
        const { data: concurrent } = await supabaseAdmin
          .from("qr_sessions")
          .select("id, token, expires_at, jobs_used, max_jobs")
          .eq("station_id", station.id)
          .eq("status", "ACTIVE")
          .is("claimed_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!concurrent) throw new Error("Could not start a print session.");
        session = concurrent;
      } else {
        throw new Error("Could not start a print session.");
      }
    }

    return {
      ok: true as const,
      station: {
        id: station.id,
        name: station.name,
        location: station.location,
        isDemo: station.is_demo,
        durationSeconds: station.session_duration_seconds,
      },
      printer: {
        name: printer?.name ?? "No printer configured",
        online: printerOnline(printer, station.is_demo),
      },
      session: {
        token: session.token,
        expiresAt: session.expires_at,
        jobsUsed: session.jobs_used,
        maxJobs: session.max_jobs,
      },
    };
  });

type SessionContext = {
  session: { id: string; expires_at: string; jobs_used: number; max_jobs: number };
  station: {
    id: string;
    name: string;
    location: string | null;
    is_demo: boolean;
    max_file_size_mb: number;
    a4_enabled: boolean;
    a3_enabled: boolean;
    color_enabled: boolean;
    duplex_enabled: boolean;
  };
};

type SessionFailure = { ok: false; reason: "INVALID" | "EXPIRED" | "LIMIT_REACHED" | "USED" };

async function loadSession(
  token: string,
  claim: string,
): Promise<({ ok: true } & SessionContext) | SessionFailure> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data } = await supabaseAdmin
    .from("qr_sessions")
    .select(
      "id, status, expires_at, jobs_used, max_jobs, claimed_at, claim_hash, station:stations(id, name, location, is_demo, max_file_size_mb, a4_enabled, a3_enabled, color_enabled, duplex_enabled)",
    )
    .eq("token", token)
    .maybeSingle();

  if (!data || !data.station) return { ok: false, reason: "INVALID" };
  if (data.status !== "ACTIVE") return { ok: false, reason: "EXPIRED" };
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin.from("qr_sessions").update({ status: "EXPIRED" }).eq("id", data.id);
    return { ok: false, reason: "EXPIRED" };
  }
  if (data.jobs_used >= data.max_jobs) return { ok: false, reason: "LIMIT_REACHED" };

  // One scan only: the first phone to open the code claims it. Any other phone
  // (or a photo of the code) is rejected, and the counter shows a fresh code.
  const claimHash = await sha256(claim);
  let expiresAt = data.expires_at;
  if (!data.claimed_at) {
    const windowEnd = new Date(Date.now() + CLAIMED_WINDOW_MS).toISOString();
    const { data: claimed } = await supabaseAdmin
      .from("qr_sessions")
      .update({ claimed_at: new Date().toISOString(), claim_hash: claimHash, expires_at: windowEnd })
      .eq("id", data.id)
      .is("claimed_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return { ok: false, reason: "USED" };
    expiresAt = windowEnd;
  } else if (data.claim_hash !== claimHash) {
    return { ok: false, reason: "USED" };
  }

  return {
    ok: true,
    session: {
      id: data.id,
      expires_at: expiresAt,
      jobs_used: data.jobs_used,
      max_jobs: data.max_jobs,
    },
    station: data.station as SessionContext["station"],
  };
}

/** Validates a scanned QR token and returns everything the mobile flow needs. */
export const validateSession = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; claim: string }) =>
    z.object({ token: z.string().min(8).max(64), claim: claimSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const result = await loadSession(data.token, data.claim);
    if (!result.ok) return result;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rules }, { data: printer }] = await Promise.all([
      supabaseAdmin
        .from("pricing_rules")
        .select("paper, color, duplex, price_per_page")
        .eq("station_id", result.station.id),
      supabaseAdmin
        .from("printers")
        .select("name, status, last_seen_at")
        .eq("station_id", result.station.id)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      ok: true as const,
      station: {
        name: result.station.name,
        location: result.station.location,
        isDemo: result.station.is_demo,
        maxFileSizeMb: result.station.max_file_size_mb,
        a4Enabled: result.station.a4_enabled,
        a3Enabled: result.station.a3_enabled,
        colorEnabled: result.station.color_enabled,
        duplexEnabled: result.station.duplex_enabled,
      },
      printerOnline: printerOnline(printer, result.station.is_demo),
      expiresAt: result.session.expires_at,
      jobsRemaining: result.session.max_jobs - result.session.jobs_used,
      rules: (rules ?? []).map((rule) => ({
        paper: rule.paper as PaperSize,
        color: rule.color as ColorMode,
        duplex: rule.duplex,
        price_per_page: Number(rule.price_per_page),
      })) satisfies PricingRule[],
    };
  });

/**
 * Issues a one-time signed upload URL scoped to this session's folder. The bucket is
 * private and the browser never sees a service key.
 */
export const createUploadTarget = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; claim: string; filename: string; size: number }) =>
    z
      .object({
        token: z.string().min(8).max(64),
        claim: claimSchema,
        filename: z.string().min(1).max(200),
        size: z.number().int().positive(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const result = await loadSession(data.token, data.claim);
    if (!result.ok) return result;

    if (!data.filename.toLowerCase().endsWith(".pdf")) {
      return { ok: false as const, reason: "NOT_PDF" as const };
    }
    if (data.size > result.station.max_file_size_mb * 1024 * 1024) {
      return { ok: false as const, reason: "TOO_LARGE" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${result.station.id}/${result.session.id}/${crypto.randomUUID()}-${safeName}`;

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !signed) return { ok: false as const, reason: "UPLOAD_UNAVAILABLE" as const };
    return { ok: true as const, path: signed.path, uploadToken: signed.token };
  });

async function countPdfPages(bytes: ArrayBuffer): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const document = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return document.getPageCount();
}

/** Reads the uploaded PDF from private storage and reports its real page count. */
export const analyzeDocument = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; claim: string; path: string }) =>
    z
      .object({ token: z.string().min(8).max(64), claim: claimSchema, path: z.string().min(4).max(400) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const result = await loadSession(data.token, data.claim);
    if (!result.ok) return result;
    if (!data.path.startsWith(`${result.station.id}/${result.session.id}/`)) {
      return { ok: false as const, reason: "INVALID" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error } = await supabaseAdmin.storage.from(BUCKET).download(data.path);
    if (error || !file) return { ok: false as const, reason: "UNREADABLE" as const };

    try {
      const bytes = await file.arrayBuffer();
      const pageCount = await countPdfPages(bytes);
      if (pageCount < 1) return { ok: false as const, reason: "UNREADABLE" as const };
      return { ok: true as const, pageCount, fileSize: bytes.byteLength };
    } catch {
      return { ok: false as const, reason: "UNREADABLE" as const };
    }
  });

/**
 * Accepts a print job. The amount is recalculated here from stored pricing and the
 * real page count in the PDF — a price sent by the browser is never trusted.
 * The idempotency key stops a double tap creating two jobs.
 */
export const submitPrintJob = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      claim: string;
      path: string;
      filename: string;
      options: unknown;
      idempotencyKey: string;
    }) =>
      z
        .object({
          token: z.string().min(8).max(64),
          claim: claimSchema,
          path: z.string().min(4).max(400),
          filename: z.string().min(1).max(200),
          options: optionsSchema,
          idempotencyKey: z.string().min(8).max(80),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const result = await loadSession(data.token, data.claim);
    if (!result.ok) return result;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const station = result.station;

    const { data: existing } = await supabaseAdmin
      .from("print_jobs")
      .select("id, job_number")
      .eq("station_id", station.id)
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return { ok: true as const, jobId: existing.id, jobNumber: existing.job_number };
    }

    const options = data.options;
    if (options.paper === "A4" && !station.a4_enabled)
      return { ok: false as const, reason: "OPTION_UNAVAILABLE" as const };
    if (options.paper === "A3" && !station.a3_enabled)
      return { ok: false as const, reason: "OPTION_UNAVAILABLE" as const };
    if (options.color === "COLOR" && !station.color_enabled)
      return { ok: false as const, reason: "OPTION_UNAVAILABLE" as const };
    if (options.duplex && !station.duplex_enabled)
      return { ok: false as const, reason: "OPTION_UNAVAILABLE" as const };

    if (!data.path.startsWith(`${station.id}/${result.session.id}/`)) {
      return { ok: false as const, reason: "INVALID" as const };
    }

    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(data.path);
    if (downloadError || !file) return { ok: false as const, reason: "UNREADABLE" as const };

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > station.max_file_size_mb * 1024 * 1024) {
      return { ok: false as const, reason: "TOO_LARGE" as const };
    }

    let pageCount: number;
    try {
      pageCount = await countPdfPages(bytes);
    } catch {
      return { ok: false as const, reason: "UNREADABLE" as const };
    }

    if (options.pageRange) {
      try {
        parsePageRange(options.pageRange, pageCount);
      } catch {
        return { ok: false as const, reason: "BAD_RANGE" as const };
      }
    }

    const { data: rules } = await supabaseAdmin
      .from("pricing_rules")
      .select("paper, color, duplex, price_per_page")
      .eq("station_id", station.id);

    const rule = findRule(
      (rules ?? []).map((r) => ({
        paper: r.paper as PaperSize,
        color: r.color as ColorMode,
        duplex: r.duplex,
        price_per_page: Number(r.price_per_page),
      })),
      options,
    );
    if (!rule) return { ok: false as const, reason: "OPTION_UNAVAILABLE" as const };

    const pages = billedPages(pageCount, options.pageRange);
    const amount = Math.round(pages * options.copies * rule.price_per_page * 100) / 100;

    const { data: printer } = await supabaseAdmin
      .from("printers")
      .select("id")
      .eq("station_id", station.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const { data: job, error } = await supabaseAdmin
      .from("print_jobs")
      .insert({
        station_id: station.id,
        printer_id: printer?.id ?? null,
        session_id: result.session.id,
        storage_path: data.path,
        filename: data.filename.slice(0, 200),
        file_size: bytes.byteLength,
        page_count: pageCount,
        printed_pages: pages,
        copies: options.copies,
        color: options.color,
        duplex: options.duplex,
        paper: options.paper,
        page_range: options.pageRange,
        amount,
        idempotency_key: data.idempotencyKey,
        demo: station.is_demo,
      })
      .select("id, job_number")
      .single();

    if (error || !job) {
      // A concurrent double-submit can hit the unique idempotency constraint.
      // Return the already-created job instead of showing a false failure.
      if (error?.code === "23505") {
        const { data: duplicate } = await supabaseAdmin
          .from("print_jobs")
          .select("id, job_number")
          .eq("station_id", station.id)
          .eq("idempotency_key", data.idempotencyKey)
          .maybeSingle();
        if (duplicate) {
          return { ok: true as const, jobId: duplicate.id, jobNumber: duplicate.job_number };
        }
      }
      return { ok: false as const, reason: "SUBMIT_FAILED" as const };
    }

    // Increment the session quota only for the job that was actually created.
    // The DB function is atomic, so two phones cannot consume the same quota slot.
    const { data: quotaOk, error: quotaError } = await (supabaseAdmin.rpc as unknown as (fn: string, args: object) => Promise<{ data: unknown; error: unknown }>)("consume_qr_session_job", {
      _session_id: result.session.id,
    });
    if (quotaError || quotaOk !== true) {
      // Do not leave an unprintable over-quota job in the queue.
      await supabaseAdmin
        .from("print_jobs")
        .update({
          status: "CANCELLED",
          error_message: "QR session job limit reached.",
        })
        .eq("id", job.id)
        .eq("status", "QUEUED");
      return { ok: false as const, reason: "LIMIT_REACHED" as const };
    }

    await supabaseAdmin.from("audit_logs").insert({
      station_id: station.id,
      actor: "student",
      action: "print_job.submitted",
      detail: { job_id: job.id, amount, pages, copies: options.copies },
    });

    return { ok: true as const, jobId: job.id, jobNumber: job.job_number };
  });

/** Public status read for the student's confirmation screen. No account required. */
export const getJobStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { jobId: string }) =>
    z.object({ jobId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("print_jobs")
      .select(
        "id, job_number, station_id, filename, page_count, printed_pages, copies, color, duplex, paper, page_range, amount, status, error_message, created_at, started_at, completed_at, demo, station:stations(name, is_demo)",
      )
      .eq("id", data.jobId)
      .maybeSingle();

    if (!job) return { ok: false as const, reason: "NOT_FOUND" as const };

    const { data: printer } = await supabaseAdmin
      .from("printers")
      .select("status, last_seen_at")
      .eq("station_id", job.station_id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    return {
      ok: true as const,
      job: { ...job, amount: Number(job.amount) },
      printerOnline: printerOnline(printer, Boolean(job.demo)),
    };
  });
