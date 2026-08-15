"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Receipt, ArrowLeft, Download } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { runRecurringExpenses } from "@/lib/recurring";
import { exportToCsv } from "@/lib/export";

type DateRange = "all" | "today" | "week" | "month";

function rangeStart(range: DateRange): Date | null {
  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (range === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (range === "month") {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

type Expense = {
  id: string;
  category: string;
  amount: number;
  payee: string | null;
  payment_method: string;
  created_at: string;
};

export default function ExpensesPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile) return;
    setBusinessId(profile.business_id);
    await runRecurringExpenses(profile.business_id);

    let expensesQuery = supabase
      .from("expenses")
      .select("id, category, amount, payee, payment_method, created_at")
      .eq("business_id", profile.business_id)
      .order("created_at", { ascending: false });

    const start = rangeStart(dateRange);
    if (start) {
      expensesQuery = expensesQuery.gte("created_at", start.toISOString());
    } else {
      expensesQuery = expensesQuery.limit(20);
    }

    const { data } = await expensesQuery;

    setExpenses(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [dateRange]);

  function handleExport() {
    exportToCsv(
      `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      expenses.map((e) => ({
        Date: new Date(e.created_at).toLocaleDateString(),
        Category: e.category,
        Payee: e.payee ?? "",
        Amount: e.amount,
        "Payment method": e.payment_method,
      }))
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("expenses").insert({
      business_id: businessId,
      category,
      amount: parseFloat(amount) || 0,
      payee: payee || null,
      payment_method: paymentMethod,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setCategory("");
    setAmount("");
    setPayee("");
    setPaymentMethod("cash");
    load();
  }

  async function handleDelete(expense: Expense) {
    if (!confirm(`Delete this ${expense.category} expense? This cannot be undone.`)) return;
    await supabase.from("expenses").delete().eq("id", expense.id);
    if (businessId) {
      await logAudit({
        businessId,
        userId,
        action: "delete",
        tableName: "expenses",
        recordId: expense.id,
        oldValue: expense,
      });
    }
    load();
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
            <Receipt size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Expenses</h1>
        </div>
        <Link href="/dashboard" className="text-sm underline font-medium flex items-center gap-1" style={{ color: "var(--navy)" }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-6">
        <section className="c-card p-5">
          <h2 className="font-semibold mb-3">Record an expense</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input
                className="w-full c-input px-3 py-2"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Rent, Supplies, Transport"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Amount (UGX)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full c-input px-3 py-2"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment method</label>
                <select
                  className="w-full c-input px-3 py-2"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank">Bank</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Paid to (optional)</label>
              <input
                className="w-full c-input px-3 py-2"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="c-btn-primary px-4 py-2 text-sm"
            >
              {saving ? "Recording..." : "Record expense"}
            </button>
          </form>
        </section>

        <section className="c-card p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-display font-semibold">Expenses</h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: "var(--border-soft)" }}>
                {(["today", "week", "month", "all"] as DateRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setDateRange(r)}
                    className="px-2.5 py-1.5 font-medium capitalize"
                    style={{
                      background: dateRange === r ? "var(--navy)" : "white",
                      color: dateRange === r ? "white" : "var(--foreground)",
                    }}
                  >
                    {r === "all" ? "All time" : r === "week" ? "7 days" : r}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExport}
                disabled={expenses.length === 0}
                className="flex items-center gap-1 text-xs font-medium border rounded-lg px-2.5 py-1.5 disabled:opacity-40"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <Download size={14} /> CSV
              </button>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-gray-500">No expenses recorded yet.</p>
          ) : (
            <div className="divide-y">
              {expenses.map((e) => (
                <div key={e.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{e.category}</p>
                    <p className="text-sm text-gray-500">
                      {e.payee ?? "—"} · {e.payment_method.replace("_", " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-red-600">
                      UGX {Number(e.amount).toLocaleString()}
                    </p>
                    <button
                      onClick={() => handleDelete(e)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
