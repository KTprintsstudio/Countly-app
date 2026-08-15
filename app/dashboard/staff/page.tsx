"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { UserCog, ArrowLeft } from "lucide-react";

type StaffMember = {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Full access — can manage staff and everything else.",
  manager: "Can record and edit everything, but cannot manage staff.",
  cashier: "Can record sales, expenses, and view stock. Cannot delete or manage staff.",
  viewer: "Can view data only. Cannot add, edit, or delete anything.",
};

export default function StaffPage() {
  const supabase = createClient();
  const [myRole, setMyRole] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("cashier");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id, role")
      .eq("id", user.id)
      .single();

    if (!profile) return;
    setMyRole(profile.role);

    const { data: staffRows } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("business_id", profile.business_id)
      .order("created_at");

    setStaff(staffRows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const res = await fetch("/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, role }),
    });
    const result = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(result.error ?? "Something went wrong");
      return;
    }

    setSuccessMsg(
      `${fullName} was added. Share these login details with them: Email: ${email} · Password: ${password}`
    );
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("cashier");
    load();
  }

  async function handleRemove(member: StaffMember) {
    if (!confirm(`Remove ${member.full_name ?? "this staff member"}'s access? This cannot be undone.`)) return;

    const res = await fetch("/api/staff/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: member.id }),
    });
    const result = await res.json();

    if (!res.ok) {
      alert(result.error ?? "Failed to remove staff member");
      return;
    }
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-sm" style={{ color: "#6B7280" }}>Loading...</p>
      </div>
    );
  }

  if (myRole !== "owner") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--background)" }}>
        <div className="text-center">
          <p className="text-sm mb-3" style={{ color: "#6B7280" }}>
            Only the business owner can manage staff.
          </p>
          <Link href="/dashboard" className="text-sm underline font-medium" style={{ color: "var(--navy)" }}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="bg-white border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <UserCog size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Staff & permissions</h1>
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
        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Add a staff member</h2>
          <form onSubmit={handleAddStaff} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Full name</label>
              <input
                className="w-full c-input px-3 py-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="w-full c-input px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Temporary password</label>
              <input
                type="text"
                minLength={6}
                className="w-full c-input px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                className="w-full c-input px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="viewer">Viewer</option>
              </select>
              <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {successMsg && (
              <p className="text-sm p-3 rounded-lg" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                {successMsg}
              </p>
            )}

            <button type="submit" disabled={saving} className="c-btn-primary px-4 py-2 text-sm">
              {saving ? "Adding..." : "Add staff member"}
            </button>
          </form>
        </section>

        <section className="c-card p-5">
          <h2 className="font-display font-semibold mb-3">Your team</h2>
          <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
            {staff.map((s) => (
              <div key={s.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{s.full_name ?? "Unnamed"}</p>
                  <p className="text-sm capitalize" style={{ color: "#6B7280" }}>{s.role}</p>
                </div>
                {s.role !== "owner" && (
                  <button
                    onClick={() => handleRemove(s)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
