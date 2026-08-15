"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Search, ArrowLeft, Package, Users, Truck } from "lucide-react";

type ProductResult = { id: string; name: string; unit_price: number; stock_quantity: number };
type CustomerResult = { id: string; name: string; phone: string | null };
type SupplierResult = { id: string; name: string; contact: string | null };

export default function SearchPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user.id)
        .single();
      if (profile) setBusinessId(profile.business_id);
    }
    init();
  }, []);

  useEffect(() => {
    if (!businessId) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setProducts([]);
      setCustomers([]);
      setSuppliers([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      const [{ data: prods }, { data: custs }, { data: sups }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, unit_price, stock_quantity")
          .eq("business_id", businessId)
          .ilike("name", `%${trimmed}%`)
          .limit(10),
        supabase
          .from("customers")
          .select("id, name, phone")
          .eq("business_id", businessId)
          .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
          .limit(10),
        supabase
          .from("suppliers")
          .select("id, name, contact")
          .eq("business_id", businessId)
          .or(`name.ilike.%${trimmed}%,contact.ilike.%${trimmed}%`)
          .limit(10),
      ]);
      setProducts(prods ?? []);
      setCustomers(custs ?? []);
      setSuppliers(sups ?? []);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, businessId]);

  const hasResults = products.length > 0 || customers.length > 0 || suppliers.length > 0;
  const trimmed = query.trim();

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="bg-white border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <Search size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Search</h1>
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
        <input
          autoFocus
          className="w-full c-input px-4 py-3 text-base"
          placeholder="Search products, customers, suppliers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {trimmed.length > 0 && trimmed.length < 2 && (
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Keep typing...</p>
        )}

        {searching && <p className="text-sm" style={{ color: "#9CA3AF" }}>Searching...</p>}

        {trimmed.length >= 2 && !searching && !hasResults && (
          <p className="text-sm" style={{ color: "#9CA3AF" }}>No matches found for &quot;{trimmed}&quot;.</p>
        )}

        {products.length > 0 && (
          <section className="c-card p-5">
            <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
              <Package size={16} style={{ color: "var(--navy)" }} /> Products
            </h2>
            <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
              {products.map((p) => (
                <div key={p.id} className="py-2 flex justify-between items-center">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm" style={{ color: "#6B7280" }}>
                    UGX {Number(p.unit_price).toLocaleString()} · {p.stock_quantity} in stock
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {customers.length > 0 && (
          <section className="c-card p-5">
            <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
              <Users size={16} style={{ color: "var(--success)" }} /> Customers
            </h2>
            <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
              {customers.map((c) => (
                <div key={c.id} className="py-2">
                  <p className="font-medium">{c.name}</p>
                  {c.phone && <p className="text-sm" style={{ color: "#6B7280" }}>{c.phone}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {suppliers.length > 0 && (
          <section className="c-card p-5">
            <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
              <Truck size={16} style={{ color: "var(--navy)" }} /> Suppliers
            </h2>
            <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
              {suppliers.map((s) => (
                <div key={s.id} className="py-2">
                  <p className="font-medium">{s.name}</p>
                  {s.contact && <p className="text-sm" style={{ color: "#6B7280" }}>{s.contact}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
