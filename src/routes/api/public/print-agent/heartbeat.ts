/**
 * POST /api/public/print-agent/heartbeat
 * Called by the Windows Print Agent every ~15s. Authenticated with the agent's
 * bearer token, which is stored only as a hash and never reaches the browser.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateAgent, jsonResponse } from "@/lib/agent-auth.server";
import { AGENT_HEARTBEAT_SECONDS } from "@/lib/agent-command";

const bodySchema = z.object({
  agentVersion: z.string().max(40).optional(),
  hostname: z.string().max(120).optional(),
  printerName: z.string().max(200).optional(),
  printerStatus: z.enum(["ONLINE", "OFFLINE"]).optional(),
});

export const Route = createFileRoute("/api/public/print-agent/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const agent = await authenticateAgent(request);
        if (!agent) return jsonResponse({ error: "Unauthorized agent" }, 401);

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return jsonResponse({ error: "Invalid heartbeat payload" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();

        await supabaseAdmin
          .from("agent_devices")
          .update({
            last_heartbeat_at: now,
            agent_version: body.agentVersion ?? null,
            hostname: body.hostname ?? null,
            reported_printer_name: body.printerName ?? null,
            reported_printer_status: body.printerStatus ?? null,
          })
          .eq("id", agent.id);

        // A heartbeat proves the agent is alive. Only change printer state when
        // the agent actually reported a printer state; an omitted field must not
        // accidentally turn an offline printer back online.
        if (agent.printer_id) {
          const printerPatch: { last_seen_at: string; windows_printer_name?: string; status?: "ONLINE" | "OFFLINE" } = {
            last_seen_at: now,
            ...(body.printerName ? { windows_printer_name: body.printerName } : {}),
          };
          if (body.printerStatus) printerPatch.status = body.printerStatus;
          await supabaseAdmin
            .from("printers")
            .update(printerPatch)
            .eq("id", agent.printer_id);
        }

        // Recover jobs abandoned during the download phase after a counter-PC
        // restart. Printing jobs are deliberately not auto-requeued because doing
        // so could duplicate a document that already reached the spooler.
        await (supabaseAdmin.rpc as unknown as (fn: string, args: object) => Promise<unknown>)("requeue_stale_downloading_jobs", {
          _station_id: agent.station_id,
        });

        const { count } = await supabaseAdmin
          .from("print_jobs")
          .select("id", { count: "exact", head: true })
          .eq("station_id", agent.station_id)
          .eq("status", "QUEUED");

        return jsonResponse({
          ok: true,
          stationId: agent.station_id,
          printerId: agent.printer_id,
          queuedJobs: count ?? 0,
          heartbeatIntervalSeconds: AGENT_HEARTBEAT_SECONDS,
          serverTime: now,
        });
      },
    },
  },
});
