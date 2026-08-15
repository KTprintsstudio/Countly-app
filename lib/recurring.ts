import { createClient } from "@/lib/supabase/client";

export async function runRecurringExpenses(businessId: string) {
  const supabase = createClient();

  const { data: templates } = await supabase
    .from("recurring_expenses")
    .select("id, category, amount, payee, payment_method, day_of_month")
    .eq("business_id", businessId)
    .eq("active", true);

  if (!templates || templates.length === 0) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const t of templates) {
    // Has this template already generated an expense this month?
    const { data: existing } = await supabase
      .from("expenses")
      .select("id")
      .eq("recurring_expense_id", t.id)
      .gte("created_at", monthStart.toISOString())
      .limit(1);

    if (existing && existing.length > 0) continue;
    if (now.getDate() < t.day_of_month) continue;

    await supabase.from("expenses").insert({
      business_id: businessId,
      category: t.category,
      amount: t.amount,
      payee: t.payee,
      payment_method: t.payment_method,
      is_recurring: true,
      recurring_expense_id: t.id,
      notes: "Auto-generated from recurring expense",
    });
  }
}
