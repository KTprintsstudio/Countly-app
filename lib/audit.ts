import { createClient } from "@/lib/supabase/client";

type AuditAction = "create" | "update" | "delete";

export async function logAudit({
  businessId,
  userId,
  action,
  tableName,
  recordId,
  oldValue,
  newValue,
}: {
  businessId: string;
  userId: string | null;
  action: AuditAction;
  tableName: string;
  recordId: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  const supabase = createClient();
  await supabase.from("audit_log").insert({
    business_id: businessId,
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
  });
}
