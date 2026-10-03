/**
 * Owner/staff dashboard server functions. Every one runs through
 * `requireSupabaseAuth`, so queries execute as the signed-in user and row-level
 * security keeps one stationery's data invisible to another.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ColorMode, PaperSize } from "./print-config";

export interface StationRecord {
  id: string;
  name: string;
  location: string | null;
  is_demo: boolean;
  session_duration_seconds: number;
  max_jobs_per_session: number;
  max_file_size_mb: number;
  a4_enabled: boolean;
  a3_enabled: boolean;
  color_enabled: boolean;
  duplex_enabled: boolean;
  currency: string;
  created_at: string;
}

const STATION_COLUMNS =
  "id, name, location, is_demo, session_duration_seconds, max_jobs_per_session, max_file_size_mb, a4_enabled, a3_enabled, color_enabled, duplex_enabled, currency, created_at";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function requireStation(supabase: { from: (table: string) => any }): Promise<StationRecord> {
  const load = () =>
    supabase
      .from("stations")
      .select(STATION_COLUMNS)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
  let { data, error } = await load();
  // One quick retry covers brief network hiccups right after the app restarts.
  if (error) {
    console.error("requireStation failed, retrying:", error.message ?? error);
    await new Promise((resolve) => setTimeout(resolve, 400));
    ({ data, error } = await load());
  }
  if (error) {
    console.error("requireStation failed:", error.message ?? error);
    throw new Error("Could not load your station.");
  }
  if (!data) throw new Error("No station is set up for this account yet.");
  return data as StationRecord;
}

/** Station, printer and agent snapshot used by the dashboard shell. */
export const getStationContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const station = await requireStation(context.supabase);

    const [{ data: printer }, { data: agent }, { data: session }] = await Promise.all([
      context.supabase
        .from("printers")
        .select(
          "id, name, model, windows_printer_name, status, last_seen_at, last_success_at, default_paper, supports_color, supports_duplex",
        )
        .eq("station_id", station.id)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("agent_devices")
        .select(
          "id, name, token_prefix, hostname, agent_version, reported_printer_name, reported_printer_status, last_heartbeat_at, revoked, created_at",
        )
        .eq("station_id", station.id)
        .eq("revoked", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("qr_sessions")
        .select("id, token, expires_at, jobs_used, max_jobs, status")
        .eq("station_id", station.id)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return { station, printer, agent, session };
  });

/**
 * Deletes uploaded documents that finished printing more than an hour ago.
 * Student files never linger in storage longer than they are needed.
 */
async function purgeFinishedFiles(stationId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stale } = await supabaseAdmin
      .from("print_jobs")
      .select("id, storage_path")
      .eq("station_id", stationId)
      .is("file_purged_at", null)
      .in("status", ["COMPLETED", "FAILED", "CANCELLED"])
      .lt("created_at", cutoff)
      .limit(25);

    if (!stale?.length) return;
    const paths = stale
      .map((row: { storage_path: string }) => row.storage_path)
      .filter(Boolean);
    if (paths.length) await supabaseAdmin.storage.from("print-files").remove(paths);
    await supabaseAdmin
      .from("print_jobs")
      .update({ file_purged_at: new Date().toISOString() })
      .in("id", stale.map((row: { id: string }) => row.id));
  } catch {
    // Cleanup is best-effort; it must never block the dashboard.
  }
}

/** Today's counters plus the live queue. */
export const getOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const station = await requireStation(context.supabase);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [{ data: today }, { data: queue }, { data: recent }] = await Promise.all([
      context.supabase
        .from("print_jobs")
        .select("amount, printed_pages, copies, status, color, paid_at")
        .eq("station_id", station.id)
        .gte("created_at", dayStart.toISOString()),
      context.supabase
        .from("print_jobs")
        .select(
          "id, job_number, filename, page_count, printed_pages, copies, color, duplex, paper, amount, status, created_at, paid_at",
        )
        .eq("station_id", station.id)
        .in("status", ["QUEUED", "DOWNLOADING", "PRINTING"])
        .order("created_at", { ascending: true })
        .limit(12),
      context.supabase
        .from("print_jobs")
        .select("id, job_number, filename, amount, status, created_at, completed_at, paid_at, file_purged_at")
        .eq("station_id", station.id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    void purgeFinishedFiles(station.id);

    const rows = today ?? [];
    type TodayRow = {
      amount: number;
      printed_pages: number;
      copies: number;
      status: string;
      color: "BW" | "COLOR";
      paid_at: string | null;
    };
    const billable = (rows as TodayRow[]).filter(
      (row) => row.status !== "FAILED" && row.status !== "CANCELLED",
    );
    const pages = (list: TodayRow[]) =>
      list.reduce((sum, row) => sum + row.printed_pages * row.copies, 0);

    return {
      stationId: station.id,
      todayJobs: rows.length,
      todayPages: pages(billable),
      todayColorPages: pages(billable.filter((row) => row.color === "COLOR")),
      todayBwPages: pages(billable.filter((row) => row.color === "BW")),
      todayRevenue: billable.reduce((sum, row) => sum + Number(row.amount), 0),
      todayCollected: billable
        .filter((row) => row.paid_at)
        .reduce((sum, row) => sum + Number(row.amount), 0),
      queue: queue ?? [],
      recent: recent ?? [],
    };
  });


const jobFilterSchema = z.object({
  status: z.enum(["ALL", "QUEUED", "DOWNLOADING", "PRINTING", "COMPLETED", "FAILED"]).default("ALL"),
  search: z.string().max(80).default(""),
  limit: z.number().int().min(1).max(200).default(60),
});

export const listPrintJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => jobFilterSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);

    let query = context.supabase
      .from("print_jobs")
      .select(
        "id, job_number, filename, page_count, printed_pages, copies, color, duplex, paper, page_range, amount, status, error_message, created_at, started_at, completed_at, failed_at, attempts, demo",
      )
      .eq("station_id", station.id)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "ALL") query = query.eq("status", data.status);

    const search = data.search.trim();
    if (search) {
      const numeric = search.replace(/[^0-9]/g, "");
      query = numeric
        ? query.or(`filename.ilike.%${search}%,job_number.eq.${numeric}`)
        : query.ilike("filename", `%${search}%`);
    }

    const { data: jobs, error } = await query;
    if (error) throw new Error("Could not load print jobs.");
    return { jobs: jobs ?? [] };
  });

export const getPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const station = await requireStation(context.supabase);
    const { data } = await context.supabase
      .from("pricing_rules")
      .select("id, paper, color, duplex, price_per_page")
      .eq("station_id", station.id);
    return {
      station,
      rules: (data ?? []).map((rule: { price_per_page: number }) => ({
        ...rule,
        price_per_page: Number(rule.price_per_page),
      })),
    };
  });

export const savePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rules: z
          .array(
            z.object({
              paper: z.enum(["A4", "A3"]),
              color: z.enum(["BW", "COLOR"]),
              duplex: z.boolean(),
              price_per_page: z.number().min(0).max(9999),
            }),
          )
          .min(1)
          .max(16),
        availability: z.object({
          a4_enabled: z.boolean(),
          a3_enabled: z.boolean(),
          color_enabled: z.boolean(),
          duplex_enabled: z.boolean(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);

    for (const rule of data.rules) {
      const { error } = await context.supabase
        .from("pricing_rules")
        .upsert(
          {
            station_id: station.id,
            paper: rule.paper,
            color: rule.color,
            duplex: rule.duplex,
            price_per_page: rule.price_per_page,
          },
          { onConflict: "station_id,paper,color,duplex" },
        );
      if (error) throw new Error(error.message || "Could not save pricing.");
    }

    const { error: stationError } = await context.supabase
      .from("stations")
      .update(data.availability)
      .eq("id", station.id);
    if (stationError) throw new Error("Could not save availability.");

    await context.supabase.from("audit_logs").insert({
      station_id: station.id,
      actor: context.userId,
      action: "pricing.updated",
      detail: { rules: data.rules.length },
    });

    return { ok: true as const };
  });

export const saveStationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(2).max(80),
        location: z.string().max(120).nullable(),
        session_duration_seconds: z.number().int().min(20).max(300),
        max_jobs_per_session: z.number().int().min(1).max(20),
        max_file_size_mb: z.number().int().min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);
    const { error } = await context.supabase.from("stations").update(data).eq("id", station.id);
    if (error) throw new Error("Could not save settings.");
    await context.supabase.from("audit_logs").insert({
      station_id: station.id,
      actor: context.userId,
      action: "station.settings_updated",
      detail: data,
    });
    return { ok: true as const };
  });

export const savePrinter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(2).max(80),
        model: z.string().max(120).nullable(),
        windows_printer_name: z.string().max(200).nullable(),
        default_paper: z.enum(["A4", "A3"]),
        supports_color: z.boolean(),
        supports_duplex: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);
    const { data: existing } = await context.supabase
      .from("printers")
      .select("id")
      .eq("station_id", station.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const { error } = existing
      ? await context.supabase.from("printers").update(data).eq("id", existing.id)
      : await context.supabase.from("printers").insert({ ...data, station_id: station.id });

    if (error) throw new Error("Could not save the printer.");
    return { ok: true as const };
  });

/**
 * Issues a new agent credential. The plaintext token is returned exactly once and
 * only the hash is stored; any previous credential for the station is revoked.
 */
export const issueAgentToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().min(2).max(60).default("Windows Print Agent") }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);
    const { hashToken, randomToken, agentTokenPrefix } = await import("./agent-auth.server");

    const { data: printer } = await context.supabase
      .from("printers")
      .select("id")
      .eq("station_id", station.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const token = `qpa_${randomToken()}`;

    await context.supabase
      .from("agent_devices")
      .update({ revoked: true })
      .eq("station_id", station.id)
      .eq("revoked", false);

    const { error } = await context.supabase.from("agent_devices").insert({
      station_id: station.id,
      printer_id: printer?.id ?? null,
      name: data.name,
      token_hash: await hashToken(token),
      token_prefix: agentTokenPrefix(token),
    });
    if (error) throw new Error("Could not create the agent credential.");

    await context.supabase.from("audit_logs").insert({
      station_id: station.id,
      actor: context.userId,
      action: "agent.token_issued",
      detail: { name: data.name },
    });

    return { ok: true as const, token, stationId: station.id };
  });

export const revokeAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ agentId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);
    const { error } = await context.supabase
      .from("agent_devices")
      .update({ revoked: true })
      .eq("id", data.agentId)
      .eq("station_id", station.id);
    if (error) throw new Error("Could not revoke the agent.");
    return { ok: true as const };
  });

/**
 * Demo Print Agent: advances a job one step so the workflow can be exercised before
 * the real Windows agent is installed. It never talks to a printer and every job it
 * touches stays flagged as a demo run.
 */
export const advanceDemoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        jobId: z.string().uuid(),
        outcome: z.enum(["ADVANCE", "FAIL"]).default("ADVANCE"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);
    const { data: job } = await context.supabase
      .from("print_jobs")
      .select("id, status")
      .eq("id", data.jobId)
      .eq("station_id", station.id)
      .maybeSingle();

    if (!job) throw new Error("That job is not part of your station.");

    const now = new Date().toISOString();
    if (data.outcome === "FAIL") {
      await context.supabase
        .from("print_jobs")
        .update({
          status: "FAILED",
          failed_at: now,
          error_message: "Demo Print Agent: simulated printer failure. No document was printed.",
        })
        .eq("id", job.id);
      return { ok: true as const, status: "FAILED" as const };
    }

    const next =
      job.status === "QUEUED"
        ? "DOWNLOADING"
        : job.status === "DOWNLOADING"
          ? "PRINTING"
          : job.status === "PRINTING"
            ? "COMPLETED"
            : null;

    if (!next) return { ok: true as const, status: job.status as "COMPLETED" };

    await context.supabase
      .from("print_jobs")
      .update({
        status: next,
        ...(next === "DOWNLOADING" ? { claimed_at: now, started_at: now } : {}),
        ...(next === "COMPLETED" ? { completed_at: now, error_message: null } : {}),
      })
      .eq("id", job.id);

    await context.supabase.from("audit_logs").insert({
      station_id: station.id,
      actor: "demo-agent",
      action: `print_job.${next.toLowerCase()}`,
      detail: { job_id: job.id, demo: true },
    });

    return { ok: true as const, status: next };
  });

export const cancelPrintJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);
    const { error } = await context.supabase
      .from("print_jobs")
      .update({ status: "CANCELLED", error_message: "Cancelled at the counter." })
      .eq("id", data.jobId)
      .eq("station_id", station.id)
      .in("status", ["QUEUED", "DOWNLOADING"]);
    if (error) throw new Error("Could not cancel that job.");
    return { ok: true as const };
  });

/** Records (or clears) cash collected at the counter for one job. */
export const setJobPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ jobId: z.string().uuid(), paid: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);
    const { error } = await context.supabase
      .from("print_jobs")
      .update({ paid_at: data.paid ? new Date().toISOString() : null })
      .eq("id", data.jobId)
      .eq("station_id", station.id);
    if (error) throw new Error("Could not update payment for that job.");
    await context.supabase.from("audit_logs").insert({
      station_id: station.id,
      actor: context.userId,
      action: data.paid ? "print_job.marked_paid" : "print_job.marked_unpaid",
      detail: { job_id: data.jobId },
    });
    return { ok: true as const };
  });

/**
 * Sends a finished job back to the queue, e.g. after a paper jam or a smudged
 * page. Only possible while the uploaded document is still in storage.
 */
export const reprintJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const station = await requireStation(context.supabase);
    const { data: job } = await context.supabase
      .from("print_jobs")
      .select("id, status, file_purged_at")
      .eq("id", data.jobId)
      .eq("station_id", station.id)
      .maybeSingle();

    if (!job) throw new Error("That job is not part of your station.");
    if (job.file_purged_at) {
      throw new Error("That document was already deleted, so it cannot be printed again.");
    }
    if (!["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
      throw new Error("That job is still in the queue.");
    }

    const { error } = await context.supabase
      .from("print_jobs")
      .update({
        status: "QUEUED",
        claimed_by: null,
        claimed_at: null,
        started_at: null,
        completed_at: null,
        failed_at: null,
        error_message: null,
      })
      .eq("id", job.id);
    if (error) throw new Error("Could not send that job back to the printer.");

    await context.supabase.from("audit_logs").insert({
      station_id: station.id,
      actor: context.userId,
      action: "print_job.reprinted",
      detail: { job_id: job.id },
    });
    return { ok: true as const };
  });


export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const station = await requireStation(context.supabase);
    const { data } = await context.supabase
      .from("audit_logs")
      .select("id, actor, action, detail, created_at")
      .eq("station_id", station.id)
      .order("created_at", { ascending: false })
      .limit(60);
    return { logs: data ?? [] };
  });

export type DashboardPricingRule = {
  id: string;
  paper: PaperSize;
  color: ColorMode;
  duplex: boolean;
  price_per_page: number;
};
