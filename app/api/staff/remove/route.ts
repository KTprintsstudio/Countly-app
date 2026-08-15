import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can remove staff" }, { status: 403 });
  }

  const { staffId } = await req.json();
  if (!staffId) {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }
  if (staffId === user.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  // Confirm the target staff member actually belongs to this owner's business
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", staffId)
    .single();

  if (!targetProfile || targetProfile.business_id !== profile.business_id) {
    return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin.auth.admin.deleteUser(staffId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
