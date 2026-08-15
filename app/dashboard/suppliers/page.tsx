"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Truck, ArrowLeft } from "lucide-react";
import { logAudit } from "@/lib/audit";

type Supplier = { id: string; name: string; contact: string | null; notes: string | null };
type Purchase = {
  id: string;
  amount: number;
  amount_paid: number;
  purchase_date: string;
  status: string;
  suppliers: { name: string } | null;
};

export default function SuppliersPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Add supplier form
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  // Log purchase form
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

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

    const [{ data: sups }, { data: purch }] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id, name, contact, notes")
        .eq("business_id", profile.business_id)
        .order("name"),
      supabase
        .from("supplier_purchases")
        .select("id, amount, amount_paid, purchase_date, status, suppliers(name)")
        .eq("business_id", profile.business_id)
        .order("purchase_date", { ascending: false })
        .limit(20),
    ]);

    setSuppliers(sups ?? []);
    setPurchases((purch as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSavingSupplier(true);
    setSupplierError(null);

    const { error } = await supabase.from("suppliers").insert({
      business_id: businessId,
      name,
      contact: contact || null,
    });

    setSavingSupplier(false);

    if (error) {
      setSupplierError(error.message);
      return;
    }

    setName("");
    setContact("");
    load();
  }

  async function handleAddPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || !supplierId) return;
    setSavingPurchase(true);
    setPurchaseError(null);

    const { error } = await supabase.from("supplier_purchases").insert({
      business_id: businessId,
      supplier_id: supplierId,
      amount: parseFloat(amount) || 0,
      purchase_date: purchaseDate || new Date().toISOString().slice(0, 10),
      status: "unpaid",
    });

    setSavingPurchase(false);

    if (error) {
      setPurchaseError(error.message);
      return;
    }

    setSupplierId("");
    setAmount("");
    setPurchaseDate("");
    load();
  }

  async function markPaid(purchase: Purchase) {
    await supabase
      .from("supplier_purchases")
      .update({ amount_paid: purchase.amount, status: "paid" })
      .eq("id", purchase.id);
    load();
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    if (!confirm(`Delete "${supplier.name}"? This cannot be undone.`)) return;
    await supabase.from("suppliers").delete().eq("id", supplier.id);
    if (businessId) {
      await logAudit({
        businessId,
        userId,
        action: "delete",
        tableName: "suppliers",
        recordId: supplier.id,
        oldValue: supplier,
      });
    }
    load();
  }

  const totalOwedToSuppliers = purchases
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (Number(p.amount) - Number(p.amount_paid)), 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="bg-white border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <Truck size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Suppliers</h1>
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
        {totalOwedToSuppliers > 0 && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
          >
            You owe suppliers UGX {totalOwedToSuppliers.toLocaleString()} in total
          </div>
        )}

        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Add a supplier</h2>
          <form onSubmit={handleAddSupplier} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Supplier name</label>
              <input
                className="w-full c-input px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact (optional)</label>
              <input
                className="w-full c-input px-3 py-2"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone number or address"
              />
            </div>
            {supplierError && <p className="text-sm text-red-600">{supplierError}</p>}
            <button type="submit" disabled={savingSupplier} className="c-btn-primary px-4 py-2 text-sm">
              {savingSupplier ? "Adding..." : "Add supplier"}
            </button>
          </form>
        </section>

        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Log a purchase</h2>
          {suppliers.length === 0 ? (
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Add a supplier above before logging a purchase.
            </p>
          ) : (
            <form onSubmit={handleAddPurchase} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <select
                  className="w-full c-input px-3 py-2"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
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
                  <label className="block text-sm font-medium mb-1">Purchase date</label>
                  <input
                    type="date"
                    className="w-full c-input px-3 py-2"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>
              {purchaseError && <p className="text-sm text-red-600">{purchaseError}</p>}
              <button type="submit" disabled={savingPurchase} className="c-btn-primary px-4 py-2 text-sm">
                {savingPurchase ? "Logging..." : "Log purchase"}
              </button>
            </form>
          )}
        </section>

        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Recent purchases</h2>
          {loading ? (
            <p className="text-sm" style={{ color: "#6B7280" }}>Loading...</p>
          ) : purchases.length === 0 ? (
            <p className="text-sm" style={{ color: "#6B7280" }}>No purchases logged yet.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
              {purchases.map((p) => (
                <div key={p.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{p.suppliers?.name ?? "Unknown"}</p>
                    <p className="text-sm" style={{ color: "#6B7280" }}>
                      UGX {Number(p.amount).toLocaleString()} ·{" "}
                      {new Date(p.purchase_date).toLocaleDateString()}
                    </p>
                  </div>
                  {p.status === "paid" ? (
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-full"
                      style={{ background: "var(--success-bg)", color: "var(--success)" }}
                    >
                      Paid
                    </span>
                  ) : (
                    <button
                      onClick={() => markPaid(p)}
                      className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50"
                    >
                      Mark paid
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Your suppliers</h2>
          {suppliers.length === 0 ? (
            <p className="text-sm" style={{ color: "#6B7280" }}>
              No suppliers yet — add your first one above.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
              {suppliers.map((s) => (
                <div key={s.id} className="py-3 flex justify-between items-start">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    {s.contact && (
                      <p className="text-sm" style={{ color: "#6B7280" }}>{s.contact}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteSupplier(s)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
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
