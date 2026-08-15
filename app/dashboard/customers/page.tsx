"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Users, ArrowLeft } from "lucide-react";
import { logAudit } from "@/lib/audit";

type Customer = { id: string; name: string; phone: string | null; notes: string | null };

export default function CustomersPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
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
      .from("customers")
      .select("id, name, phone, notes")
      .eq("business_id", profile.business_id)
      .order("name");

    setCustomers(data ?? []);
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

    const { error } = await supabase.from("customers").insert({
      business_id: businessId,
      name,
      phone: phone || null,
      notes: notes || null,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setName("");
    setPhone("");
    setNotes("");
    load();
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`Delete "${customer.name}"? This cannot be undone.`)) return;
    await supabase.from("customers").delete().eq("id", customer.id);
    if (businessId) {
      await logAudit({
        businessId,
        userId,
        action: "delete",
        tableName: "customers",
        recordId: customer.id,
        oldValue: customer,
      });
    }
    load();
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
            <Users size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Customers</h1>
        </div>
        <Link href="/dashboard" className="text-sm underline font-medium flex items-center gap-1" style={{ color: "var(--navy)" }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-6">
        <section className="c-card p-5">
          <h2 className="font-semibold mb-3">Add a customer</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                className="w-full c-input px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone (optional)</label>
              <input
                className="w-full c-input px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <input
                className="w-full c-input px-3 py-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="c-btn-primary px-4 py-2 text-sm"
            >
              {saving ? "Adding..." : "Add customer"}
            </button>
          </form>
        </section>

        <section className="c-card p-5">
          <h2 className="font-semibold mb-3">Your customers</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : customers.length === 0 ? (
            <p className="text-sm text-gray-500">No customers yet — add your first one above.</p>
          ) : (
            <div className="divide-y">
              {customers.map((c) => (
                <div key={c.id} className="py-3 flex justify-between items-start">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    {c.phone && <p className="text-sm text-gray-500">{c.phone}</p>}
                    {c.notes && <p className="text-sm text-gray-400">{c.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(c)}
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
