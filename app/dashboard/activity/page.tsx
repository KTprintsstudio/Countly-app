"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { History, ArrowLeft, Trash2, Pencil, Plus } from "lucide-react";

type AuditEntry = {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_value: any;
  new_value: any;
  created_at: string;
  user_id: string | null;
};

const TABLE_LABELS: Record<string, string> = {
  products: "product",
  customers: "customer",
  expenses: "expense",
  sales: "sale",
  debts: "debt",
};

export default function ActivityPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
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
        .select("business_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      const { data: log } = await supabase
        .from("audit_log")
        .select("id, action, table_name, record_id, old_value, new_value, created_at, user_id")
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false })
        .limit(50);

      setEntries(log ?? []);

      const userIds = Array.from(new Set((log ?? []).map((e) => e.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds as string[]);
        const map: Record<string, string> = {};
        (profiles ?? []).forEach((p: any) => {
          map[p.id] = p.full_name ?? "Someone";
        });
        setNames(map);
      }

      setLoading(false);
    }
    load();
  }, []);

  function describe(entry: AuditEntry): string {
    const label = TABLE_LABELS[entry.table_name] ?? entry.table_name;
    const name =
      entry.old_value?.name ??
      entry.old_value?.category ??
      entry.new_value?.name ??
      entry.new_value?.category ??
      "";
    if (entry.action === "delete") return `deleted ${label}${name ? ` "${name}"` : ""}`;
    if (entry.action === "update") return `updated ${label}${name ? ` "${name}"` : ""}`;
    return `added ${label}${name ? ` "${name}"` : ""}`;
  }

  function iconFor(action: string) {
    if (action === "delete") return <Trash2 size={15} style={{ color: "var(--danger)" }} />;
    if (action === "update") return <Pencil size={15} style={{ color: "var(--warning)" }} />;
    return <Plus size={15} style={{ color: "var(--success)" }} />;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="bg-white border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <History size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Activity history</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm underline font-medium flex items-center gap-1"
          style={{ color: "var(--navy)" }}
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        <div className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Recent changes</h2>
          {loading ? (
            <p className="text-sm" style={{ color: "#6B7280" }}>Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm" style={{ color: "#6B7280" }}>
              No changes recorded yet. Deletions and edits will show up here as they happen.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
              {entries.map((e) => (
                <div key={e.id} className="py-3 flex items-start gap-3">
                  <span className="mt-0.5">{iconFor(e.action)}</span>
                  <div className="flex-1">
                    <p className="text-sm">
                      <b>{names[e.user_id ?? ""] ?? "Someone"}</b> {describe(e)}
                    </p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
