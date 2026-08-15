"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Package, ArrowLeft } from "lucide-react";
import { logAudit } from "@/lib/audit";

type Product = {
  id: string;
  name: string;
  unit_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
};

export default function ProductsPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const { data } = await supabase
      .from("products")
      .select("id, name, unit_price, stock_quantity, low_stock_threshold")
      .eq("business_id", profile.business_id)
      .order("name");

    setProducts(data ?? []);
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

    const { error } = await supabase.from("products").insert({
      business_id: businessId,
      name,
      unit_price: parseFloat(price) || 0,
      stock_quantity: parseFloat(stock) || 0,
      low_stock_threshold: parseFloat(threshold) || 5,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setName("");
    setPrice("");
    setStock("");
    setThreshold("5");
    load();
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    await supabase.from("products").delete().eq("id", product.id);
    if (businessId) {
      await logAudit({
        businessId,
        userId,
        action: "delete",
        tableName: "products",
        recordId: product.id,
        oldValue: product,
      });
    }
    load();
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--gold-light)", color: "var(--navy-dark)" }}>
            <Package size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Products & Inventory</h1>
        </div>
        <Link href="/dashboard" className="text-sm underline font-medium flex items-center gap-1" style={{ color: "var(--navy)" }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-6">
        <section className="c-card p-5">
          <h2 className="font-semibold mb-3">Add a product</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Product name</label>
              <input
                className="w-full c-input px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Unit price</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full c-input px-3 py-2"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock qty</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full c-input px-3 py-2"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Low-stock alert</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full c-input px-3 py-2"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="c-btn-primary px-4 py-2 text-sm"
            >
              {saving ? "Adding..." : "Add product"}
            </button>
          </form>
        </section>

        <section className="c-card p-5">
          <h2 className="font-semibold mb-3">Your products</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-gray-500">No products yet — add your first one above.</p>
          ) : (
            <div className="divide-y">
              {products.map((p) => (
                <div key={p.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-gray-500">UGX {Number(p.unit_price).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p
                      className={`text-sm font-medium ${
                        p.stock_quantity <= p.low_stock_threshold ? "text-amber-600" : "text-gray-600"
                      }`}
                    >
                      {p.stock_quantity} in stock
                      {p.stock_quantity <= p.low_stock_threshold && " ⚠"}
                    </p>
                    <button
                      onClick={() => handleDelete(p)}
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
