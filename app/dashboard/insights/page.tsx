"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LineChart, ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type MonthBucket = {
  key: string;
  label: string;
  sales: number;
  expenses: number;
  profit: number;
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short" });
}

export default function InsightsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("UGX");
  const [months, setMonths] = useState<MonthBucket[]>([]);
  const [salesChangePct, setSalesChangePct] = useState<number | null>(null);
  const [expenseChangePct, setExpenseChangePct] = useState<number | null>(null);
  const [topMover, setTopMover] = useState<{ name: string; change: number; direction: "up" | "down" } | null>(null);
  const [topExpenseMover, setTopExpenseMover] = useState<{ category: string; change: number; direction: "up" | "down" } | null>(null);
  const [bestSellers, setBestSellers] = useState<{ name: string; qty: number }[]>([]);
  const [slowSellers, setSlowSellers] = useState<{ name: string; qty: number }[]>([]);

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

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const [{ data: sales }, { data: expenses }] = await Promise.all([
        supabase
          .from("sales")
          .select("total_amount, status, created_at")
          .eq("business_id", businessId)
          .gte("created_at", sixMonthsAgo.toISOString()),
        supabase
          .from("expenses")
          .select("amount, category, created_at")
          .eq("business_id", businessId)
          .gte("created_at", sixMonthsAgo.toISOString()),
      ]);

      // Build 6 month buckets
      const buckets: Record<string, MonthBucket> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = monthKey(d);
        buckets[key] = { key, label: monthLabel(d), sales: 0, expenses: 0, profit: 0 };
      }

      (sales ?? []).forEach((s) => {
        if (s.status !== "completed") return;
        const key = monthKey(new Date(s.created_at));
        if (buckets[key]) buckets[key].sales += Number(s.total_amount);
      });
      (expenses ?? []).forEach((e) => {
        const key = monthKey(new Date(e.created_at));
        if (buckets[key]) buckets[key].expenses += Number(e.amount);
      });
      Object.values(buckets).forEach((b) => (b.profit = b.sales - b.expenses));

      const monthList = Object.values(buckets);
      setMonths(monthList);

      // This month vs last month % change
      const thisMonth = monthList[monthList.length - 1];
      const lastMonth = monthList[monthList.length - 2];
      if (lastMonth) {
        setSalesChangePct(
          lastMonth.sales === 0 ? null : ((thisMonth.sales - lastMonth.sales) / lastMonth.sales) * 100
        );
        setExpenseChangePct(
          lastMonth.expenses === 0 ? null : ((thisMonth.expenses - lastMonth.expenses) / lastMonth.expenses) * 100
        );
      }

      // Top expense category mover (this month vs last month)
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);
      const lastMonthStart = new Date(thisMonthStart);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

      const catThis: Record<string, number> = {};
      const catLast: Record<string, number> = {};
      (expenses ?? []).forEach((e) => {
        const d = new Date(e.created_at);
        if (d >= thisMonthStart) catThis[e.category] = (catThis[e.category] ?? 0) + Number(e.amount);
        else if (d >= lastMonthStart && d < thisMonthStart)
          catLast[e.category] = (catLast[e.category] ?? 0) + Number(e.amount);
      });
      let biggestCatChange = 0;
      let biggestCat: string | null = null;
      let biggestCatDir: "up" | "down" = "up";
      Object.keys({ ...catThis, ...catLast }).forEach((cat) => {
        const diff = (catThis[cat] ?? 0) - (catLast[cat] ?? 0);
        if (Math.abs(diff) > Math.abs(biggestCatChange)) {
          biggestCatChange = diff;
          biggestCat = cat;
          biggestCatDir = diff >= 0 ? "up" : "down";
        }
      });
      if (biggestCat) {
        setTopExpenseMover({ category: biggestCat, change: Math.abs(biggestCatChange), direction: biggestCatDir });
      }

      // Top product mover by revenue (this month vs last month)
      const { data: recentSales } = await supabase
        .from("sales")
        .select("id, created_at")
        .eq("business_id", businessId)
        .gte("created_at", lastMonthStart.toISOString());

      const saleIds = (recentSales ?? []).map((s) => s.id);
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from("sale_items")
          .select("quantity, unit_price, sale_id, products(name)")
          .in("sale_id", saleIds);

        const saleDateMap: Record<string, string> = {};
        (recentSales ?? []).forEach((s) => (saleDateMap[s.id] = s.created_at));

        const prodThis: Record<string, number> = {};
        const prodLast: Record<string, number> = {};
        (items ?? []).forEach((item: any) => {
          const d = new Date(saleDateMap[item.sale_id]);
          const revenue = Number(item.quantity) * Number(item.unit_price);
          const name = item.products?.name ?? "Unknown";
          if (d >= thisMonthStart) prodThis[name] = (prodThis[name] ?? 0) + revenue;
          else if (d >= lastMonthStart && d < thisMonthStart)
            prodLast[name] = (prodLast[name] ?? 0) + revenue;
        });

        let biggestProdChange = 0;
        let biggestProd: string | null = null;
        let biggestProdDir: "up" | "down" = "up";
        Object.keys({ ...prodThis, ...prodLast }).forEach((name) => {
          const diff = (prodThis[name] ?? 0) - (prodLast[name] ?? 0);
          if (Math.abs(diff) > Math.abs(biggestProdChange)) {
            biggestProdChange = diff;
            biggestProd = name;
            biggestProdDir = diff >= 0 ? "up" : "down";
          }
        });
        if (biggestProd) {
          setTopMover({ name: biggestProd, change: Math.abs(biggestProdChange), direction: biggestProdDir });
        }
      }

      // Best/slow sellers by quantity sold, last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { data: recentSalesWide } = await supabase
        .from("sales")
        .select("id")
        .eq("business_id", businessId)
        .gte("created_at", ninetyDaysAgo.toISOString());

      const wideSaleIds = (recentSalesWide ?? []).map((s) => s.id);
      if (wideSaleIds.length > 0) {
        const { data: allItems } = await supabase
          .from("sale_items")
          .select("quantity, product_id, products(name)")
          .in("sale_id", wideSaleIds);

        const qtyByProduct: Record<string, { name: string; qty: number }> = {};
        (allItems ?? []).forEach((item: any) => {
          const id = item.product_id;
          const name = item.products?.name ?? "Unknown";
          if (!qtyByProduct[id]) qtyByProduct[id] = { name, qty: 0 };
          qtyByProduct[id].qty += Number(item.quantity);
        });

        const sorted = Object.values(qtyByProduct).sort((a, b) => b.qty - a.qty);
        setBestSellers(sorted.slice(0, 5));
        setSlowSellers([...sorted].reverse().slice(0, 5));
      }

      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="bg-white border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <LineChart size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Insights</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm underline font-medium flex items-center gap-1"
          style={{ color: "var(--navy)" }}
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-6">
        {loading ? (
          <p className="text-sm" style={{ color: "#6B7280" }}>Loading insights...</p>
        ) : (
          <>
            <section className="c-card p-5">
              <h2 className="font-display font-semibold mb-4">Last 6 months</h2>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={months} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => `${currency} ${Number(value ?? 0).toLocaleString()}`}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="sales" fill="var(--navy)" name="Sales" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="var(--gold)" name="Expenses" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="c-card p-5">
              <h2 className="font-display font-semibold mb-3">What changed this month</h2>
              <div className="space-y-3 text-sm">
                <ChangeLine
                  label="Sales"
                  pct={salesChangePct}
                />
                <ChangeLine
                  label="Expenses"
                  pct={expenseChangePct}
                  invertColor
                />
                {topMover && (
                  <p style={{ color: "#374151" }}>
                    <b>{topMover.name}</b> is your biggest mover — revenue{" "}
                    {topMover.direction === "up" ? "rose" : "fell"} by {currency}{" "}
                    {topMover.change.toLocaleString()} compared to last month.
                  </p>
                )}
                {topExpenseMover && (
                  <p style={{ color: "#374151" }}>
                    <b>{topExpenseMover.category}</b> expenses{" "}
                    {topExpenseMover.direction === "up" ? "increased" : "decreased"} by {currency}{" "}
                    {topExpenseMover.change.toLocaleString()} — the biggest driver of your expense change.
                  </p>
                )}
                {!topMover && !topExpenseMover && (
                  <p style={{ color: "#9CA3AF" }}>
                    Not enough data yet to identify what&apos;s driving changes — check back after a
                    few weeks of activity.
                  </p>
                )}
              </div>
            </section>

            {(bestSellers.length > 0 || slowSellers.length > 0) && (
              <section className="c-card p-5">
                <h2 className="font-display font-semibold mb-3">Best & slow sellers</h2>
                <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>
                  Ranked by quantity sold over the last 90 days
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--success)" }}>
                      TOP SELLERS
                    </p>
                    <div className="space-y-1.5">
                      {bestSellers.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{p.name}</span>
                          <span style={{ color: "#6B7280" }}>{p.qty} sold</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--danger)" }}>
                      SLOW SELLERS
                    </p>
                    <div className="space-y-1.5">
                      {slowSellers.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{p.name}</span>
                          <span style={{ color: "#6B7280" }}>{p.qty} sold</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="c-card p-5">
              <h2 className="font-display font-semibold mb-3">Monthly reports</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: "#6B7280" }}>
                    <th className="pb-2 font-normal">Month</th>
                    <th className="pb-2 font-normal text-right">Sales</th>
                    <th className="pb-2 font-normal text-right">Expenses</th>
                    <th className="pb-2 font-normal text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {[...months].reverse().map((m) => (
                    <tr key={m.key} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="py-2">{m.label}</td>
                      <td className="py-2 text-right">{currency} {m.sales.toLocaleString()}</td>
                      <td className="py-2 text-right">{currency} {m.expenses.toLocaleString()}</td>
                      <td
                        className="py-2 text-right font-medium"
                        style={{ color: m.profit >= 0 ? "var(--success)" : "var(--danger)" }}
                      >
                        {currency} {m.profit.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ChangeLine({
  label,
  pct,
  invertColor = false,
}: {
  label: string;
  pct: number | null;
  invertColor?: boolean;
}) {
  if (pct === null) {
    return (
      <p style={{ color: "#9CA3AF" }}>
        {label}: not enough data from last month to compare yet.
      </p>
    );
  }
  const isUp = pct >= 0;
  const good = invertColor ? !isUp : isUp;
  const color = good ? "var(--success)" : "var(--danger)";
  const Icon = pct === 0 ? Minus : isUp ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center gap-2">
      <Icon size={16} style={{ color }} />
      <p>
        <b>{label}</b> {isUp ? "up" : "down"} <span style={{ color, fontWeight: 600 }}>{Math.abs(pct).toFixed(0)}%</span> vs last month
      </p>
    </div>
  );
}
