"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Wallet, ArrowLeft, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

type Obligation = { label: string; amount: number; when: string };

export default function CashflowPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("UGX");
  const [moneyIn, setMoneyIn] = useState(0);
  const [moneyOut, setMoneyOut] = useState(0);
  const [obligations, setObligations] = useState<Obligation[]>([]);

  useEffect(() => {
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
      const businessId = profile.business_id;
      setCurrency((profile.businesses as any)?.currency ?? "UGX");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [{ data: sales }, { data: expenses }, { data: supplierPurchases }, { data: recurring }] =
        await Promise.all([
          supabase
            .from("sales")
            .select("total_amount, status")
            .eq("business_id", businessId)
            .gte("created_at", thirtyDaysAgo.toISOString()),
          supabase
            .from("expenses")
            .select("amount")
            .eq("business_id", businessId)
            .gte("created_at", thirtyDaysAgo.toISOString()),
          supabase
            .from("supplier_purchases")
            .select("amount, amount_paid, status, suppliers(name)")
            .eq("business_id", businessId)
            .neq("status", "paid"),
          supabase
            .from("recurring_expenses")
            .select("category, amount, day_of_month")
            .eq("business_id", businessId)
            .eq("active", true),
        ]);

      const collected = (sales ?? [])
        .filter((s) => s.status === "completed")
        .reduce((sum, s) => sum + Number(s.total_amount), 0);
      const spentOnExpenses = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
      const paidToSuppliers = 0; // purchases marked unpaid are excluded here; paid ones already left the 30-day window logic simple

      setMoneyIn(collected);
      setMoneyOut(spentOnExpenses + paidToSuppliers);

      const obs: Obligation[] = [];
      (supplierPurchases ?? []).forEach((p: any) => {
        const remaining = Number(p.amount) - Number(p.amount_paid);
        if (remaining > 0) {
          obs.push({
            label: `Owed to ${p.suppliers?.name ?? "supplier"}`,
            amount: remaining,
            when: "Outstanding",
          });
        }
      });
      (recurring ?? []).forEach((r) => {
        obs.push({
          label: r.category,
          amount: Number(r.amount),
          when: `Day ${r.day_of_month} of each month`,
        });
      });
      obs.sort((a, b) => b.amount - a.amount);
      setObligations(obs);

      setLoading(false);
    }
    load();
  }, []);

  const net = moneyIn - moneyOut;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="bg-white border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <Wallet size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Cash flow</h1>
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
        {loading ? (
          <p className="text-sm" style={{ color: "#6B7280" }}>Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="c-card p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowDownCircle size={16} style={{ color: "var(--success)" }} />
                  <p className="text-xs" style={{ color: "#6B7280" }}>Money in (30d)</p>
                </div>
                <p className="font-display text-lg font-semibold" style={{ color: "var(--success)" }}>
                  {currency} {moneyIn.toLocaleString()}
                </p>
              </div>
              <div className="c-card p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowUpCircle size={16} style={{ color: "var(--danger)" }} />
                  <p className="text-xs" style={{ color: "#6B7280" }}>Money out (30d)</p>
                </div>
                <p className="font-display text-lg font-semibold" style={{ color: "var(--danger)" }}>
                  {currency} {moneyOut.toLocaleString()}
                </p>
              </div>
              <div className="c-card p-4">
                <p className="text-xs mb-1" style={{ color: "#6B7280" }}>Net (30d)</p>
                <p
                  className="font-display text-lg font-semibold"
                  style={{ color: net >= 0 ? "var(--success)" : "var(--danger)" }}
                >
                  {net >= 0 ? "+" : ""}
                  {currency} {net.toLocaleString()}
                </p>
              </div>
            </div>

            <section className="c-card p-5">
              <h2 className="font-display font-semibold mb-3">Upcoming obligations</h2>
              {obligations.length === 0 ? (
                <p className="text-sm" style={{ color: "#6B7280" }}>
                  Nothing owed to suppliers or recurring right now.
                </p>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
                  {obligations.map((o, i) => (
                    <div key={i} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{o.label}</p>
                        <p className="text-sm" style={{ color: "#6B7280" }}>{o.when}</p>
                      </div>
                      <p className="font-medium" style={{ color: "var(--warning)" }}>
                        {currency} {o.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              Money in/out is based on the last 30 days. Set up recurring expenses and log
              supplier purchases to see fuller upcoming obligations here.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
