/**
 * Dashboard data hooks. Every read goes through an authenticated server function,
 * and Supabase Realtime pushes queue changes so the counter never needs to refresh.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getOverview, getStationContext } from "@/lib/station.functions";

export function useStationContext() {
  const fn = useServerFn(getStationContext);
  return useQuery({
    queryKey: ["station-context"],
    queryFn: () => fn({ data: undefined }),
    staleTime: 15_000,
    retry: 2,
  });
}

export function useOverview() {
  const fn = useServerFn(getOverview);
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => fn({ data: undefined }),
    refetchInterval: 20_000,
    retry: 2,
  });
}

/** Invalidate dashboard reads whenever the queue, printer or agent changes. */
export function useRealtimeDashboard(stationId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!stationId) return;
    const channel = supabase
      .channel(`dashboard-${stationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "print_jobs", filter: `station_id=eq.${stationId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["overview"] });
          void queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "printers" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["station-context"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_devices" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["station-context"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [stationId, queryClient]);
}
