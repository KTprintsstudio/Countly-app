"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Settings, ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id, businesses(name, logo_url)")
        .eq("id", user.id)
        .single();

      if (profile) {
        setBusinessId(profile.business_id);
        const biz = profile.businesses as any;
        setBusinessName(biz?.name ?? "");
        setLogoUrl(biz?.logo_url ?? null);
      }
    }
    load();
  }, []);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;

    setUploading(true);
    setMessage(null);

    const ext = file.name.split(".").pop();
    const path = `${businessId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("business-logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setMessage(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("business-logos")
      .getPublicUrl(path);

    const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("businesses")
      .update({ logo_url: publicUrl })
      .eq("id", businessId);

    setUploading(false);

    if (updateError) {
      setMessage(`Saved logo but failed to update business: ${updateError.message}`);
      return;
    }

    setLogoUrl(publicUrl);
    setMessage("Logo updated.");
  }

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("businesses")
      .update({ name: businessName })
      .eq("id", businessId);

    setSaving(false);
    setMessage(error ? `Failed: ${error.message}` : "Business name updated.");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex items-center gap-3">
          <span className="c-icon-tile w-9 h-9" style={{ background: "var(--navy)", color: "white" }}>
            <Settings size={18} />
          </span>
          <h1 className="font-display font-semibold text-lg">Business settings</h1>
        </div>
        <Link href="/dashboard" className="text-sm underline font-medium flex items-center gap-1" style={{ color: "var(--navy)" }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </header>

      <main className="p-6 max-w-lg mx-auto space-y-8">
        <section className="c-card p-5">
          <h2 className="font-semibold mb-3">Business name</h2>
          <form onSubmit={handleNameSave} className="flex gap-2">
            <input
              className="flex-1 c-input px-3 py-2"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <button
              type="submit"
              disabled={saving}
              className="c-btn-primary px-4 py-2 text-sm"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
        </section>

        <section className="c-card p-5">
          <h2 className="font-semibold mb-3">Business logo</h2>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Business logo"
              className="w-24 h-24 object-contain rounded-lg border mb-4"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            disabled={uploading}
          />
          {uploading && <p className="text-sm text-gray-500 mt-2">Uploading...</p>}
        </section>

        {message && <p className="text-sm text-gray-600">{message}</p>}
      </main>
    </div>
  );
}
