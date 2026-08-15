"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Target, ArrowLeft } from "lucide-react";

type Goal = { goal_type: string; target_amount: number };

export default function GoalsPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("UGX");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [salesTarget, setSalesTarget] = useState("");
  const [profitTarget, setProfitTarget] = useState("");

  const [actualSales, setActualSales] = useState(0);
  const [actualProfit, setActualProfit] = useState(0);

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id, businesses(currency)")
      .eq("id", user.id)
      .single();

    if (!profile) return;
    setBusinessId(profile.business_id);
    setCurrency((profile.businesses as any)?.currency ?? "UGX");

    const periodStr = periodStart.toISOString().slice(0, 10);

    const [{ data: goals }, { data: sales }, { data: expenses }] = await Promise.all([
      supabase
        .from("goals")
        .select("goal_type, target_amount")
        .eq("business_id", profile.business_id)
        .eq("period_start", periodStr),
      supabase
        .from("sales")
        .select("total_amount, status")
        .eq("business_id", profile.business_id)
        .gte("created_at", periodStart.toISOString()),
      supabase
        .from("expenses")
        .select("amount")
        .eq("business_id", profile.business_id)
        .gte("created_at", periodStart.toISOString()),
    ]);

    (goals ?? []).forEach((g: Goal) => {
      if (g.goal_type === "sales") setSalesTarget(String(g.target_amount));
      if (g.goal_type === "profit") setProfitTarget(String(g.target_amount));
    });

    const collected = (sales ?? [])
      .filter((s) => s.status === "completed")
      .reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

    setActualSales(collected);
    setActualProfit(collected - totalExpenses);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);

    const periodStr = periodStart.toISOString().slice(0, 10);
    const upserts = [];

    if (salesTarget) {
      upserts.push(
        supabase.from("goals").upsert(
          {
            business_id: businessId,
            goal_type: "sales",
            target_amount: parseFloat(salesTarget) || 0,
            period_start: periodStr,
          },
          { onConflict: "business_id,goal_type,period_start" }
        )
      );
    }
    if (profitTarget) {
      upserts.push(
        supabase.from("goals").upsert(
          {
            business_id: businessId,
            goal_type: "profit",
            target_amount: parseFloat(profitTarget) || 0,
            period_start: periodStr,
          },
          { onConflict: "business_id,goal_type,period_start" }
        )
      );
    }

    await Promise.all(upserts);
    setSaving(false);
    load();
  }

  const salesPct = salesTarget ? Math.min(100, (actualSales / parseFloat(salesTarget)) * 100) : 0;
  const profitPct = profitTarget ? Math.min(100, (actualProfit / parseFloat(profitTarget)) * 100) : 0;
  const monthName = periodStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="bg-white border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <Target size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Goals</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm underline font-medium flex items-center gap-1"
          style={{ color: "var(--navy)" }}
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-6">
        {!loading && (salesTarget || profitTarget) && (
          <section className="c-card p-5">
            <h2 className="font-display font-semibold mb-1">{monthName} progress</h2>
            <div className="space-y-5 mt-4">
              {salesTarget && (
                <ProgressBar
                  label="Sales"
                  actual={actualSales}
                  target={parseFloat(salesTarget)}
                  pct={salesPct}
                  currency={currency}
                  color="var(--navy)"
                />
              )}
              {profitTarget && (
                <ProgressBar
                  label="Profit"
                  actual={actualProfit}
                  target={parseFloat(profitTarget)}
                  pct={profitPct}
                  currency={currency}
                  color="var(--success)"
                />
              )}
            </div>
          </section>
        )}

        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Set this month&apos;s targets</h2>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Sales target ({currency})</label>
              <input
                type="number"
                className="w-full c-input px-3 py-2"
                value={salesTarget}
                onChange={(e) => setSalesTarget(e.target.value)}
                placeholder="e.g. 5000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Profit target ({currency})</label>
              <input
                type="number"
                className="w-full c-input px-3 py-2"
                value={profitTarget}
                onChange={(e) => setProfitTarget(e.target.value)}
                placeholder="e.g. 1500000"
              />
            </div>
            <button type="submit" disabled={saving} className="c-btn-primary px-4 py-2 text-sm">
              {saving ? "Saving..." : "Save targets"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function ProgressBar({
  label,
  actual,
  target,
  pct,
  currency,
  color,
}: {
  label: string;
  actual: number;
  target: number;
  pct: number;
  currency: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium">{label}</span>
        <span style={{ color: "#6B7280" }}>
          {currency} {actual.toLocaleString()} / {currency} {target.toLocaleString()}
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full" style={{ background: "var(--border-soft)" }}>
        <div
          className="h-2.5 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
        {pct.toFixed(0)}% of target
      </p>
    </div>
  );
}
