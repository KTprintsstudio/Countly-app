"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ShoppingCart, ArrowLeft, Download } from "lucide-react";
import { exportToCsv } from "@/lib/export";

type Product = { id: string; name: string; unit_price: number; stock_quantity: number };
type Customer = { id: string; name: string };
type Sale = {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  customers: { name: string } | null;
};

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

export default function SalesPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");

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

    let salesQuery = supabase
      .from("sales")
      .select("id, total_amount, payment_method, status, created_at, customers(name)")
      .eq("business_id", profile.business_id)
      .order("created_at", { ascending: false });

    const start = rangeStart(dateRange);
    if (start) {
      salesQuery = salesQuery.gte("created_at", start.toISOString());
    } else {
      salesQuery = salesQuery.limit(20);
    }

    const [{ data: prods }, { data: custs }, { data: saleRows }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, unit_price, stock_quantity")
        .eq("business_id", profile.business_id)
        .order("name"),
      supabase
        .from("customers")
        .select("id, name")
        .eq("business_id", profile.business_id)
        .order("name"),
      salesQuery,
    ]);

    setProducts(prods ?? []);
    setCustomers(custs ?? []);
    setSales((saleRows as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [dateRange]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || !productId) return;
    setSaving(true);
    setError(null);

    const product = products.find((p) => p.id === productId);
    if (!product) {
      setError("Select a product");
      setSaving(false);
      return;
    }

    const qty = parseFloat(quantity) || 0;
    const total = qty * Number(product.unit_price);

    if (paymentStatus === "credit" && !customerId) {
      setError("A customer is required for credit sales, so you know who owes you.");
      setSaving(false);
      return;
    }

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        business_id: businessId,
        customer_id: customerId || null,
        total_amount: total,
        payment_method: paymentMethod,
        status: paymentStatus === "credit" ? "pending" : "completed",
      })
      .select()
      .single();

    if (saleError) {
      setError(saleError.message);
      setSaving(false);
      return;
    }

    await supabase.from("sale_items").insert({
      sale_id: sale.id,
      product_id: product.id,
      quantity: qty,
      unit_price: product.unit_price,
    });

    await supabase
      .from("products")
      .update({ stock_quantity: Number(product.stock_quantity) - qty })
      .eq("id", product.id);

    if (paymentStatus === "credit") {
      await supabase.from("debts").insert({
        business_id: businessId,
        customer_id: customerId,
        amount_owed: total,
        status: "open",
      });
    }

    setSaving(false);
    setProductId("");
    setQuantity("1");
    setCustomerId("");
    setPaymentMethod("cash");
    setPaymentStatus("paid");
    load();
  }

  function handleExport() {
    exportToCsv(
      `sales-${new Date().toISOString().slice(0, 10)}.csv`,
      sales.map((s) => ({
        Date: new Date(s.created_at).toLocaleDateString(),
        Customer: s.customers?.name ?? "Walk-in",
        Total: s.total_amount,
        "Payment method": s.payment_method,
        Status: s.status,
      }))
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <ShoppingCart size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Sales</h1>
        </div>
        <Link href="/dashboard" className="text-sm underline font-medium flex items-center gap-1" style={{ color: "var(--navy)" }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-6">
        <section className="c-card p-5">
          <h2 className="font-semibold mb-3">Record a sale</h2>
          {products.length === 0 ? (
            <p className="text-sm text-gray-500">
              You need to{" "}
              <Link href="/dashboard/products" className="underline">
                add a product
              </Link>{" "}
              before you can record a sale.
            </p>
          ) : (
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Product</label>
                <select
                  className="w-full c-input px-3 py-2"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  required
                >
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — UGX {Number(p.unit_price).toLocaleString()} ({p.stock_quantity} in stock)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="w-full c-input px-3 py-2"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
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
                <label className="block text-sm font-medium mb-1">Payment status</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("paid")}
                    className="border rounded-lg py-2 text-sm font-medium"
                    style={{
                      borderColor: paymentStatus === "paid" ? "var(--navy)" : "var(--border-soft)",
                      background: paymentStatus === "paid" ? "var(--navy)" : "white",
                      color: paymentStatus === "paid" ? "white" : "var(--foreground)",
                    }}
                  >
                    Paid now
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("credit")}
                    className="border rounded-lg py-2 text-sm font-medium"
                    style={{
                      borderColor: paymentStatus === "credit" ? "var(--warning)" : "var(--border-soft)",
                      background: paymentStatus === "credit" ? "var(--warning-bg)" : "white",
                      color: paymentStatus === "credit" ? "var(--warning)" : "var(--foreground)",
                    }}
                  >
                    On credit (pay later)
                  </button>
                </div>
                {paymentStatus === "credit" && (
                  <p className="text-xs mt-1" style={{ color: "var(--warning)" }}>
                    This will be added to the customer&apos;s outstanding debt.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Customer {paymentStatus === "credit" ? "(required for credit sales)" : "(optional)"}
                </label>
                <select
                  className="w-full c-input px-3 py-2"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required={paymentStatus === "credit"}
                >
                  <option value="">Walk-in / no customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="c-btn-primary px-4 py-2 text-sm"
              >
                {saving ? "Recording..." : "Record sale"}
              </button>
            </form>
          )}
        </section>

        <section className="c-card p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-display font-semibold">Sales</h2>
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
                disabled={sales.length === 0}
                className="flex items-center gap-1 text-xs font-medium border rounded-lg px-2.5 py-1.5 disabled:opacity-40"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <Download size={14} /> CSV
              </button>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : sales.length === 0 ? (
            <p className="text-sm text-gray-500">No sales recorded yet.</p>
          ) : (
            <div className="divide-y">
              {sales.map((s) => (
                <div key={s.id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">UGX {Number(s.total_amount).toLocaleString()}</p>
                      {s.status === "pending" && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
                        >
                          On credit
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {s.customers?.name ?? "Walk-in"} · {s.payment_method.replace("_", " ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
                    <Link
                      href={`/dashboard/sales/${s.id}/receipt`}
                      className="text-sm font-medium underline"
                      style={{ color: "var(--navy)" }}
                    >
                      Receipt
                    </Link>
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
