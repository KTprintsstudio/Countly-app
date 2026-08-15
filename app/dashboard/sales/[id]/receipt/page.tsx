"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Printer, Share2 } from "lucide-react";

type SaleDetail = {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  notes: string | null;
  created_at: string;
  customers: { name: string; phone: string | null } | null;
};

type LineItem = {
  id: string;
  quantity: number;
  unit_price: number;
  products: { name: string } | null;
};

type Business = {
  name: string;
  currency: string;
  logo_url: string | null;
};

export default function ReceiptPage() {
  const supabase = createClient();
  const params = useParams();
  const saleId = params.id as string;

  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("businesses(name, currency, logo_url)")
        .eq("id", user.id)
        .single();

      if (profile?.businesses) setBusiness(profile.businesses as any);

      const { data: saleData } = await supabase
        .from("sales")
        .select("id, total_amount, payment_method, status, notes, created_at, customers(name, phone)")
        .eq("id", saleId)
        .single();

      setSale((saleData as any) ?? null);

      const { data: lineItems } = await supabase
        .from("sale_items")
        .select("id, quantity, unit_price, products(name)")
        .eq("sale_id", saleId);

      setItems((lineItems as any) ?? []);
      setLoading(false);
    }
    load();
  }, [saleId]);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt from ${business?.name ?? "Countly"}`,
          text: `Receipt for UGX ${sale?.total_amount.toLocaleString()} — ${new Date(
            sale?.created_at ?? ""
          ).toLocaleDateString()}`,
          url: window.location.href,
        });
      } catch {
        // user cancelled share, do nothing
      }
    } else {
      window.print();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-sm" style={{ color: "#6B7280" }}>Loading receipt...</p>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-sm" style={{ color: "#6B7280" }}>Receipt not found.</p>
      </div>
    );
  }

  const currency = business?.currency ?? "UGX";
  const receiptNumber = sale.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <header
        className="no-print bg-white border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <h1 className="font-display font-semibold text-lg">Receipt</h1>
        <Link
          href="/dashboard/sales"
          className="text-sm underline font-medium flex items-center gap-1"
          style={{ color: "var(--navy)" }}
        >
          <ArrowLeft size={14} /> Back to sales
        </Link>
      </header>

      <main className="p-6 max-w-md mx-auto">
        <div className="no-print flex gap-3 mb-4">
          <button
            onClick={() => window.print()}
            className="c-btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
          <button
            onClick={handleShare}
            className="flex-1 border rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <Share2 size={16} /> Share
          </button>
        </div>

        <div className="c-card p-6">
          <div className="text-center mb-6">
            {business?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logo_url}
                alt={business.name}
                className="h-14 mx-auto mb-2 object-contain"
              />
            ) : (
              <h2 className="font-display text-xl font-semibold">{business?.name ?? "Your Business"}</h2>
            )}
            <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
              Receipt #{receiptNumber}
            </p>
          </div>

          <div className="flex justify-between text-sm mb-4 pb-4 border-b" style={{ borderColor: "var(--border-soft)" }}>
            <div>
              <p style={{ color: "#6B7280" }}>Date</p>
              <p className="font-medium">{new Date(sale.created_at).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p style={{ color: "#6B7280" }}>Customer</p>
              <p className="font-medium">{sale.customers?.name ?? "Walk-in"}</p>
            </div>
          </div>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left" style={{ color: "#6B7280" }}>
                <th className="pb-2 font-normal">Item</th>
                <th className="pb-2 font-normal text-center">Qty</th>
                <th className="pb-2 font-normal text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                  <td className="py-2">{item.products?.name ?? "Item"}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">
                    {currency} {(Number(item.quantity) * Number(item.unit_price)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            className="flex justify-between items-center pt-3 border-t font-display text-lg font-semibold"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <span>Total</span>
            <span>
              {currency} {Number(sale.total_amount).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between text-xs mt-3" style={{ color: "#9CA3AF" }}>
            <span>Payment: {sale.payment_method.replace("_", " ")}</span>
            <span>{sale.status === "pending" ? "On credit — not yet paid" : "Paid"}</span>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>
            Thank you for your business
          </p>
        </div>
      </main>
    </div>
  );
}
