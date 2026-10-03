/**
 * Pricing: per-page rates for every paper/colour/sides combination plus the
 * availability toggles that decide which options students can even see.
 * Prices are always applied server-side when a job is submitted.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader, Panel, SaveButton } from "@/components/dashboard/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PRICING_MATRIX, formatMoney } from "@/lib/print-config";
import { getPricing, savePricing } from "@/lib/station.functions";

export const Route = createFileRoute("/_authenticated/dashboard/pricing")({
  component: PricingPage,
});

type RuleKey = `${"A4" | "A3"}|${"BW" | "COLOR"}|${"single" | "double"}`;

function keyOf(rule: { paper: string; color: string; duplex: boolean }): RuleKey {
  return `${rule.paper}|${rule.color}|${rule.duplex ? "double" : "single"}` as RuleKey;
}

function PricingPage() {
  const pricingFn = useServerFn(getPricing);
  const saveFn = useServerFn(savePricing);
  const queryClient = useQueryClient();

  const pricing = useQuery({
    queryKey: ["pricing"],
    queryFn: () => pricingFn({ data: undefined }),
  });

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState({
    a4_enabled: true,
    a3_enabled: true,
    color_enabled: true,
    duplex_enabled: true,
  });

  useEffect(() => {
    if (!pricing.data) return;
    const next: Record<string, string> = {};
    const rules = pricing.data.rules as unknown as Array<{
      paper: string;
      color: string;
      duplex: boolean;
      price_per_page: number;
    }>;
    for (const rule of rules) next[keyOf(rule)] = String(rule.price_per_page);
    setPrices(next);
    setAvailability({
      a4_enabled: pricing.data.station.a4_enabled,
      a3_enabled: pricing.data.station.a3_enabled,
      color_enabled: pricing.data.station.color_enabled,
      duplex_enabled: pricing.data.station.duplex_enabled,
    });
  }, [pricing.data]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          rules: PRICING_MATRIX.map((entry) => ({
            paper: entry.paper,
            color: entry.color,
            duplex: entry.duplex,
            price_per_page: Number(prices[keyOf(entry)] ?? 0),
          })),
          availability,
        },
      }),
    onSuccess: () => {
      toast.success("Pricing saved.");
      void queryClient.invalidateQueries({ queryKey: ["pricing"] });
      void queryClient.invalidateQueries({ queryKey: ["station-context"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing"
        description="Set your per-page rates. The price a student sees is always recalculated from these rates on the server."
      />

      {pricing.isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {(["A4", "A3"] as const).map((paper) => (
              <Panel key={paper} title={`${paper} paper`} description="Price per page">
                <div className="space-y-3">
                  {PRICING_MATRIX.filter((entry) => entry.paper === paper).map((entry) => {
                    const key = keyOf(entry);
                    return (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <Label htmlFor={key} className="text-sm font-normal text-muted-foreground">
                          {entry.label}
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">₹</span>
                          <Input
                            id={key}
                            type="number"
                            min={0}
                            step="0.5"
                            value={prices[key] ?? ""}
                            onChange={(event) =>
                              setPrices((current) => ({ ...current, [key]: event.target.value }))
                            }
                            className="w-24 rounded-lg text-right tabular-nums"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            ))}
          </div>

          <Panel title="What students can choose" description="Hidden options can't be submitted">
            <div className="grid gap-4 sm:grid-cols-2">
              <Toggle
                label="A4 paper"
                checked={availability.a4_enabled}
                onChange={(value) => setAvailability((a) => ({ ...a, a4_enabled: value }))}
              />
              <Toggle
                label="A3 paper"
                checked={availability.a3_enabled}
                onChange={(value) => setAvailability((a) => ({ ...a, a3_enabled: value }))}
              />
              <Toggle
                label="Colour printing"
                checked={availability.color_enabled}
                onChange={(value) => setAvailability((a) => ({ ...a, color_enabled: value }))}
              />
              <Toggle
                label="Double-sided printing"
                checked={availability.duplex_enabled}
                onChange={(value) => setAvailability((a) => ({ ...a, duplex_enabled: value }))}
              />
            </div>
          </Panel>

          <div className="flex items-center gap-3">
            <SaveButton pending={save.isPending} />
            <p className="text-xs text-muted-foreground">
              Example: 8 pages × 2 copies of A4 B&amp;W single-sided at{" "}
              {formatMoney(Number(prices["A4|BW|single"] ?? 0))} per page ={" "}
              {formatMoney(Number(prices["A4|BW|single"] ?? 0) * 16)}.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
