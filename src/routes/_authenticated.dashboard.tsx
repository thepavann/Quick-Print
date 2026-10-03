/**
 * Dashboard shell: sticky sidebar, top bar with live printer/agent state, and the
 * outlet every counter page renders into.
 */
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { StatusDot } from "@/components/brand";
import {
  DASHBOARD_NAV,
  DashboardSidebar,
  DashboardTopBar,
  MobileNav,
  useMobileNav,
} from "@/components/dashboard/shell";
import { useRealtimeDashboard, useStationContext } from "@/components/dashboard/use-station";
import { AGENT_OFFLINE_AFTER_SECONDS, isAgentOnline } from "@/lib/agent-command";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Counter dashboard · QuickPrint" },
      {
        name: "description",
        content:
          "Manage your QuickPrint counter: live print queue, printer and agent status, pricing, QR sessions and history.",
      },
      { property: "og:title", content: "Counter dashboard · QuickPrint" },
      {
        property: "og:description",
        content: "Live print queue, printer status, pricing and QR session controls for your counter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { open, openNav, closeNav } = useMobileNav();
  const { data } = useStationContext();
  useRealtimeDashboard(data?.station.id);

  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current =
    [...DASHBOARD_NAV]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)) ?? DASHBOARD_NAV[0];

  const agentOnline = isAgentOnline(data?.agent?.last_heartbeat_at ?? null);
  const printerOnline = data?.printer?.status === "ONLINE" && agentOnline;

  return (
    <div className="min-h-screen bg-background">
      <MobileNav open={open} onClose={closeNav} />
      <div className="md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen md:block">
          <DashboardSidebar />
        </aside>

        <div className="min-w-0">
          <DashboardTopBar
            title={current.label}
            stationName={data?.station.name}
            onOpenNav={openNav}
            right={
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="hidden items-center gap-1.5 sm:inline-flex">
                  <StatusDot tone={agentOnline ? "online" : "offline"} pulse={agentOnline} />
                  {agentOnline ? "Print Agent Online" : "Print Agent Offline"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot tone={printerOnline ? "online" : "offline"} />
                  {printerOnline ? "Printer Online" : "Printer Offline"}
                </span>
              </div>
            }
          />
          <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
          <p className="px-4 pb-8 text-center text-xs text-muted-foreground/70 md:px-8">
            Printing happens on the stationery PC through the Windows Print Agent. Status turns offline
            after {AGENT_OFFLINE_AFTER_SECONDS} seconds without a heartbeat.
          </p>
        </div>
      </div>
    </div>
  );
}
