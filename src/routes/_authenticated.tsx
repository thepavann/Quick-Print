/**
 * Counter-side gate. Students never reach these routes: without a Supabase
 * session the layout redirects to /login before any child page mounts.
 */
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready">("checking");

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setStatus("ready");
      else void navigate({ to: "/login", replace: true });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) setStatus("ready");
      else void navigate({ to: "/login", replace: true });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  if (status === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your counter…
        </div>
      </div>
    );
  }

  return <Outlet />;
}
