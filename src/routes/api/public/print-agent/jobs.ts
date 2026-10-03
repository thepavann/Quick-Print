/**
 * GET /api/public/print-agent/jobs
 * Returns this station's queued jobs in FIFO order. An agent only ever sees jobs
 * belonging to the station its credential is bound to.
 */
import { createFileRoute } from "@tanstack/react-router";

import { authenticateAgent, jsonResponse } from "@/lib/agent-auth.server";

export const Route = createFileRoute("/api/public/print-agent/jobs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const agent = await authenticateAgent(request);
        if (!agent) return jsonResponse({ error: "Unauthorized agent" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("print_jobs")
          .select(
            "id, job_number, filename, page_count, copies, color, duplex, paper, page_range, status, created_at",
          )
          .eq("station_id", agent.station_id)
          .eq("status", "QUEUED")
          .order("created_at", { ascending: true })
          .limit(20);

        if (error) return jsonResponse({ error: "Could not read the queue" }, 500);
        return jsonResponse({ ok: true, jobs: data ?? [] });
      },
    },
  },
});
