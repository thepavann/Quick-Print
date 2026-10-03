/**
 * POST /api/public/print-agent/jobs/:jobId/status
 * The agent reports progress: DOWNLOADING -> PRINTING -> COMPLETED, or FAILED with
 * the exact local error message. Only the agent that claimed the job may report on it.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateAgent, jsonResponse } from "@/lib/agent-auth.server";

const bodySchema = z.object({
  status: z.enum(["DOWNLOADING", "PRINTING", "COMPLETED", "FAILED"]),
  errorMessage: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/public/print-agent/jobs/$jobId/status")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const agent = await authenticateAgent(request);
        if (!agent) return jsonResponse({ error: "Unauthorized agent" }, 401);

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Invalid status payload" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: job } = await supabaseAdmin
          .from("print_jobs")
          .select("id, station_id, claimed_by, status")
          .eq("id", params.jobId)
          .maybeSingle();

        if (!job || job.station_id !== agent.station_id) {
          return jsonResponse({ error: "Job not found for this station" }, 404);
        }
        if (job.claimed_by !== agent.id) {
          return jsonResponse({ error: "Job is not claimed by this agent" }, 409);
        }

        const allowedTransitions: Record<string, string[]> = {
          DOWNLOADING: ["DOWNLOADING"],
          PRINTING: ["DOWNLOADING", "PRINTING"],
          COMPLETED: ["PRINTING"],
          FAILED: ["DOWNLOADING", "PRINTING"],
        };
        if (!allowedTransitions[body.status]?.includes(job.status)) {
          return jsonResponse(
            { error: `Invalid transition from ${job.status} to ${body.status}` },
            409,
          );
        }

        const now = new Date().toISOString();
        const patch: {
          status: typeof body.status;
          started_at?: string;
          completed_at?: string;
          failed_at?: string;
          error_message?: string | null;
        } = { status: body.status };
        if (body.status === "PRINTING") patch.started_at = now;
        if (body.status === "COMPLETED") {
          patch.completed_at = now;
          patch.error_message = null;
        }
        if (body.status === "FAILED") {
          patch.failed_at = now;
          patch.error_message = body.errorMessage ?? "The print agent reported a failure.";
        }

        const { error } = await supabaseAdmin.from("print_jobs").update(patch).eq("id", job.id);
        if (error) return jsonResponse({ error: "Could not update the job" }, 500);

        if (body.status === "COMPLETED" && agent.printer_id) {
          await supabaseAdmin
            .from("printers")
            .update({ last_success_at: now })
            .eq("id", agent.printer_id);
        }

        await supabaseAdmin.from("audit_logs").insert({
          station_id: agent.station_id,
          actor: `agent:${agent.name}`,
          action: `print_job.${body.status.toLowerCase()}`,
          detail: { job_id: job.id, error: body.errorMessage ?? null },
        });

        return jsonResponse({ ok: true, status: body.status });
      },
    },
  },
});
