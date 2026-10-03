/**
 * POST /api/public/print-agent/jobs/:jobId/claim
 * Atomically claims a queued job (QUEUED -> DOWNLOADING) and returns a short-lived
 * signed download URL plus the print settings the agent should apply locally.
 * The claim is a single conditional UPDATE, so two agents can never take one job.
 */
import { createFileRoute } from "@tanstack/react-router";

import { authenticateAgent, jsonResponse } from "@/lib/agent-auth.server";
import { buildPrintSettings } from "@/lib/agent-command";
import type { ColorMode, PaperSize } from "@/lib/print-config";

export const Route = createFileRoute("/api/public/print-agent/jobs/$jobId/claim")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const agent = await authenticateAgent(request);
        if (!agent) return jsonResponse({ error: "Unauthorized agent" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const jobId = params.jobId === "next" ? undefined : params.jobId;

        const { data, error } = await supabaseAdmin.rpc("claim_next_print_job", {
          _station_id: agent.station_id,
          _agent_id: agent.id,
          ...(jobId ? { _job_id: jobId } : {}),
        });

        if (error) return jsonResponse({ error: "Claim failed" }, 500);

        const job = (Array.isArray(data) ? data[0] : data) as
          | {
              id: string;
              job_number: number;
              storage_path: string;
              filename: string;
              page_count: number;
              copies: number;
              color: ColorMode;
              duplex: boolean;
              paper: PaperSize;
              page_range: string | null;
            }
          | null;

        if (!job?.id) return jsonResponse({ ok: true, job: null }, 200);

        const printerQuery = supabaseAdmin
          .from("printers")
          .select("windows_printer_name, name")
          .eq("station_id", agent.station_id);

        const { data: printer } = agent.printer_id
          ? await printerQuery.eq("id", agent.printer_id).maybeSingle()
          : await printerQuery.order("created_at").limit(1).maybeSingle();

        const { data: signed } = await supabaseAdmin.storage
          .from("print-files")
          .createSignedUrl(job.storage_path, 600);

        await supabaseAdmin.from("audit_logs").insert({
          station_id: agent.station_id,
          actor: `agent:${agent.name}`,
          action: "print_job.claimed",
          detail: { job_id: job.id },
        });

        return jsonResponse({
          ok: true,
          job: {
            id: job.id,
            jobNumber: job.job_number,
            filename: job.filename,
            pageCount: job.page_count,
            downloadUrl: signed?.signedUrl ?? null,
            expectedContentType: "application/pdf",
            printerName: printer?.windows_printer_name ?? printer?.name ?? null,
            printSettings: buildPrintSettings({
              copies: job.copies,
              color: job.color,
              duplex: job.duplex,
              paper: job.paper,
              pageRange: job.page_range,
            }),
          },
        });
      },
    },
  },
});
