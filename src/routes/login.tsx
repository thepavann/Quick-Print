import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · QuickPrint" },
      {
        name: "description",
        content:
          "Sign in to the QuickPrint counter dashboard to manage your print queue, printer and pricing.",
      },
      { property: "og:title", content: "Sign in · QuickPrint" },
      {
        property: "og:description",
        content: "Manage your QuickPrint queue, printer and pricing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { station_name: shopName || "My Stationery" },
          },
        });
        if (error) throw error;
        if (data.session) {
          await navigate({ to: "/dashboard" });
        } else {
          toast.success("Check your inbox to confirm your email, then sign in.");
          setMode("signin");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in is unavailable.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted/50">
      <header className="px-5 py-5 sm:px-8">
        <Link to="/">
          <Logo />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:items-center sm:pb-24 sm:pt-0">
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft sm:p-7">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {mode === "signin" ? "Sign in to QuickPrint" : "Create your counter account"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signin"
                ? "For stationery owners and counter staff."
                : "We'll set up your station, printer and default pricing."}
            </p>

            <Button variant="outline" className="mt-6 w-full" onClick={handleGoogle} type="button">
              Continue with Google
            </Button>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                or
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="shop">Stationery name</Label>
                  <Input
                    id="shop"
                    value={shopName}
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder="ABC Stationery"
                    autoComplete="organization"
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@shop.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="font-medium text-brand underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            Students don't need an account — they just scan the QR code at your counter.
          </p>
        </div>
      </main>
    </div>
  );
}
