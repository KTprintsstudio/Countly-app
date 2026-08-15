"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Repeat, ArrowLeft } from "lucide-react";
import { runRecurringExpenses } from "@/lib/recurring";

type Template = {
  id: string;
  category: string;
  amount: number;
  payee: string | null;
  payment_method: string;
  day_of_month: number;
  active: boolean;
};

export default function RecurringPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile) return;
    setBusinessId(profile.business_id);

    await runRecurringExpenses(profile.business_id);

    const { data } = await supabase
      .from("recurring_expenses")
      .select("id, category, amount, payee, payment_method, day_of_month, active")
      .eq("business_id", profile.business_id)
      .order("created_at");

    setTemplates(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("recurring_expenses").insert({
      business_id: businessId,
      category,
      amount: parseFloat(amount) || 0,
      payee: payee || null,
      day_of_month: parseInt(dayOfMonth) || 1,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setCategory("");
    setAmount("");
    setPayee("");
    setDayOfMonth("1");
    load();
  }

  async function toggleActive(t: Template) {
    await supabase.from("recurring_expenses").update({ active: !t.active }).eq("id", t.id);
    load();
  }

  async function handleDelete(t: Template) {
    if (!confirm(`Stop and delete this recurring expense (${t.category})?`)) return;
    await supabase.from("recurring_expenses").delete().eq("id", t.id);
    load();
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="bg-white border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <Repeat size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Recurring expenses</h1>
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
        <p className="text-sm" style={{ color: "#6B7280" }}>
          Set up expenses that repeat every month — like rent or salaries — and they&apos;ll be
          added to your Expenses automatically, so you never forget one.
        </p>

        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Add a recurring expense</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input
                className="w-full c-input px-3 py-2"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Rent, Staff salary"
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
                <label className="block text-sm font-medium mb-1">Day of month</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  className="w-full c-input px-3 py-2"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                />
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
            <button type="submit" disabled={saving} className="c-btn-primary px-4 py-2 text-sm">
              {saving ? "Adding..." : "Add recurring expense"}
            </button>
          </form>
        </section>

        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Your recurring expenses</h2>
          {loading ? (
            <p className="text-sm" style={{ color: "#6B7280" }}>Loading...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm" style={{ color: "#6B7280" }}>None set up yet.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
              {templates.map((t) => (
                <div key={t.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{t.category}</p>
                    <p className="text-sm" style={{ color: "#6B7280" }}>
                      UGX {Number(t.amount).toLocaleString()} · day {t.day_of_month} of each month
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleActive(t)}
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: t.active ? "var(--success-bg)" : "var(--border-soft)",
                        color: t.active ? "var(--success)" : "#6B7280",
                      }}
                    >
                      {t.active ? "Active" : "Paused"}
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
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
