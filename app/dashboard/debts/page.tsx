"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CircleDollarSign, ArrowLeft } from "lucide-react";

type Customer = { id: string; name: string };
type Debt = {
  id: string;
  amount_owed: number;
  amount_paid: number;
  due_date: string | null;
  status: string;
  customers: { name: string } | null;
};

export default function DebtsPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
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

    const [{ data: custs }, { data: debtRows }] = await Promise.all([
      supabase.from("customers").select("id, name").eq("business_id", profile.business_id).order("name"),
      supabase
        .from("debts")
        .select("id, amount_owed, amount_paid, due_date, status, customers(name)")
        .eq("business_id", profile.business_id)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);

    setCustomers(custs ?? []);

    // Auto-mark any past-due, unpaid debts as overdue
    const today = new Date().toISOString().slice(0, 10);
    const rows = (debtRows as any as Debt[]) ?? [];
    const toFlag = rows.filter(
      (d) => d.due_date && d.due_date < today && d.status !== "paid" && d.status !== "overdue"
    );
    if (toFlag.length > 0) {
      await Promise.all(
        toFlag.map((d) => supabase.from("debts").update({ status: "overdue" }).eq("id", d.id))
      );
      rows.forEach((d) => {
        if (toFlag.find((f) => f.id === d.id)) d.status = "overdue";
      });
    }

    setDebts(rows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || !customerId) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("debts").insert({
      business_id: businessId,
      customer_id: customerId,
      amount_owed: parseFloat(amount) || 0,
      due_date: dueDate || null,
      status: "open",
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setCustomerId("");
    setAmount("");
    setDueDate("");
    load();
  }

  async function markPaid(debt: Debt) {
    await supabase
      .from("debts")
      .update({ amount_paid: debt.amount_owed, status: "paid" })
      .eq("id", debt.id);
    load();
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            <CircleDollarSign size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Debts</h1>
        </div>
        <Link href="/dashboard" className="text-sm underline font-medium flex items-center gap-1" style={{ color: "var(--navy)" }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-6">
        <section className="c-card p-5">
          <h2 className="font-semibold mb-3">Record money owed to you</h2>
          {customers.length === 0 ? (
            <p className="text-sm text-gray-500">
              You need to{" "}
              <Link href="/dashboard/customers" className="underline">
                add a customer
              </Link>{" "}
              before recording a debt.
            </p>
          ) : (
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Customer</label>
                <select
                  className="w-full c-input px-3 py-2"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount owed (UGX)</label>
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
                  <label className="block text-sm font-medium mb-1">Due date (optional)</label>
                  <input
                    type="date"
                    className="w-full c-input px-3 py-2"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="c-btn-primary px-4 py-2 text-sm"
              >
                {saving ? "Recording..." : "Record debt"}
              </button>
            </form>
          )}
        </section>

        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Outstanding debts</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : debts.filter((d) => d.status !== "paid").length === 0 ? (
            <p className="text-sm text-gray-500">No outstanding debts.</p>
          ) : (
            <div className="divide-y">
              {debts
                .filter((d) => d.status !== "paid")
                .map((d) => (
                  <div key={d.id} className="py-3 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{d.customers?.name ?? "Unknown"}</p>
                        {d.status === "overdue" && (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
                          >
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-sm" style={{ color: d.status === "overdue" ? "var(--danger)" : "#6B7280" }}>
                        UGX {(Number(d.amount_owed) - Number(d.amount_paid)).toLocaleString()} owed
                        {d.due_date && ` · due ${new Date(d.due_date).toLocaleDateString()}`}
                      </p>
                    </div>
                    <button
                      onClick={() => markPaid(d)}
                      className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50"
                    >
                      Mark paid
                    </button>
                  </div>
                ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
