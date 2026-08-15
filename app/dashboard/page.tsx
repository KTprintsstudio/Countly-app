import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "./logout-button";
import {
  ShoppingCart,
  Package,
  Receipt,
  Users,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Settings,
  History,
  Truck,
  UserCog,
  Search,
  LineChart,
  Target,
  Repeat,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, business_id, businesses(name, currency, logo_url, created_at, plan)")
    .eq("id", user!.id)
    .single();

  const businessId = profile?.business_id;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();

  const [
    { data: sales },
    { data: expenses },
    { data: lowStock },
    { data: debts },
    { data: todaySales },
    { data: todayExpenses },
  ] = await Promise.all([
    supabase.from("sales").select("total_amount, status").eq("business_id", businessId),
    supabase.from("expenses").select("amount, created_at").eq("business_id", businessId),
    supabase
      .from("products")
      .select("id, name, stock_quantity, low_stock_threshold")
      .eq("business_id", businessId),
    supabase
      .from("debts")
      .select("amount_owed, amount_paid, status, customers(name)")
      .eq("business_id", businessId)
      .neq("status", "paid"),
    supabase
      .from("sales")
      .select("total_amount")
      .eq("business_id", businessId)
      .gte("created_at", todayIso),
    supabase
      .from("expenses")
      .select("amount")
      .eq("business_id", businessId)
      .gte("created_at", todayIso),
  ]);

  const totalSales = (sales ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
  const moneyCollected = (sales ?? [])
    .filter((r) => r.status === "completed")
    .reduce((s, r) => s + Number(r.total_amount), 0);
  const totalExpenses = (expenses ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const estimatedProfit = moneyCollected - totalExpenses;
  const outstandingDebt = (debts ?? []).reduce(
    (s, r) => s + (Number(r.amount_owed) - Number(r.amount_paid)),
    0
  );
  const totalMoneyOwed = outstandingDebt;
  const overdueDebts = (debts ?? []).filter((d: any) => d.status === "overdue");
  const lowStockItems = (lowStock ?? []).filter(
    (p) => Number(p.stock_quantity) <= Number(p.low_stock_threshold)
  );

  let healthStatus: "green" | "yellow" | "red" = "green";
  if (estimatedProfit < 0 || overdueDebts.length > 0) {
    healthStatus = "red";
  } else if (lowStockItems.length > 0 || outstandingDebt > 0) {
    healthStatus = "yellow";
  }
  const healthMessage: Record<string, string> = {
    green: "Your business looks healthy — profit is positive and nothing urgent needs attention.",
    yellow: "Doing okay, but keep an eye on low stock or outstanding debts.",
    red: "Needs attention — check overdue debts or your current profit.",
  };

  const todaySalesTotal = (todaySales ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
  const todayExpensesTotal = (todayExpenses ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const todayProfit = todaySalesTotal - todayExpensesTotal;
  const todaySaleCount = (todaySales ?? []).length;

  // Unusual-change detection: is this month's expense pace much higher than the recent average?
  const nowD = new Date();
  const thisMonthStartD = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  const threeMonthsAgoD = new Date(nowD.getFullYear(), nowD.getMonth() - 3, 1);
  let thisMonthExpenseSoFar = 0;
  const priorMonthTotals: Record<string, number> = {};
  (expenses ?? []).forEach((e: any) => {
    const d = new Date(e.created_at);
    if (d >= thisMonthStartD) {
      thisMonthExpenseSoFar += Number(e.amount);
    } else if (d >= threeMonthsAgoD) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      priorMonthTotals[key] = (priorMonthTotals[key] ?? 0) + Number(e.amount);
    }
  });
  const priorMonthValues = Object.values(priorMonthTotals);
  const priorAvg =
    priorMonthValues.length > 0
      ? priorMonthValues.reduce((a, b) => a + b, 0) / priorMonthValues.length
      : 0;
  const dayOfMonth = nowD.getDate();
  const daysInMonth = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
  const projectedThisMonth = (thisMonthExpenseSoFar / dayOfMonth) * daysInMonth;
  const unusualExpenseSpike =
    priorAvg > 0 && projectedThisMonth > priorAvg * 1.5 && thisMonthExpenseSoFar > 0;

  const businessCreatedAt = (profile?.businesses as any)?.created_at as string | undefined;
  const plan = ((profile?.businesses as any)?.plan as string | undefined) ?? "basic";
  let trialDaysLeft: number | null = null;
  if (plan === "basic" && businessCreatedAt) {
    const daysSince = Math.floor(
      (Date.now() - new Date(businessCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    trialDaysLeft = Math.max(0, 14 - daysSince);
  }

  const currency = (profile?.businesses as any)?.currency ?? "UGX";
  const businessName = (profile?.businesses as any)?.name ?? "Your business";
  const logoUrl = (profile?.businesses as any)?.logo_url as string | null;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${businessName} logo`}
              className="w-11 h-11 rounded-xl object-contain border"
              style={{ borderColor: "var(--border-soft)" }}
            />
          ) : (
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-semibold font-display"
              style={{ background: "var(--navy)", color: "var(--gold)" }}
            >
              {businessName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display font-semibold text-lg leading-tight">{businessName}</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              {profile?.full_name} · {profile?.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 text-sm font-medium hover:opacity-70"
            style={{ color: "var(--navy)" }}
          >
            <Settings size={16} />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {trialDaysLeft !== null && (
          <div
            className="rounded-xl px-4 py-3 mb-6 text-sm font-medium flex items-center justify-between"
            style={{ background: "var(--gold-light)", color: "var(--navy-dark)" }}
          >
            <span>
              {trialDaysLeft > 0
                ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial`
                : "Your free trial has ended"}
            </span>
          </div>
        )}

        <div
          className="rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-3"
          style={{
            background:
              healthStatus === "green"
                ? "var(--success-bg)"
                : healthStatus === "yellow"
                ? "var(--warning-bg)"
                : "var(--danger-bg)",
            color:
              healthStatus === "green"
                ? "var(--success)"
                : healthStatus === "yellow"
                ? "var(--warning)"
                : "var(--danger)",
          }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{
              background:
                healthStatus === "green"
                  ? "var(--success)"
                  : healthStatus === "yellow"
                  ? "var(--warning)"
                  : "var(--danger)",
            }}
          />
          <span className="font-medium">{healthMessage[healthStatus]}</span>
        </div>

        <h2 className="font-display text-xl font-semibold mb-4">Dashboard</h2>

        <div className="c-card p-5 mb-6">
          <h3 className="font-display font-semibold mb-3 text-sm" style={{ color: "#6B7280" }}>
            TODAY&apos;S SNAPSHOT
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs" style={{ color: "#6B7280" }}>Sales today</p>
              <p className="font-display text-lg font-semibold">
                {currency} {todaySalesTotal.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "#6B7280" }}>Expenses today</p>
              <p className="font-display text-lg font-semibold">
                {currency} {todayExpensesTotal.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "#6B7280" }}>Profit/loss today</p>
              <p
                className="font-display text-lg font-semibold"
                style={{ color: todayProfit >= 0 ? "var(--success)" : "var(--danger)" }}
              >
                {todayProfit >= 0 ? "+" : ""}
                {currency} {todayProfit.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "#6B7280" }}>Sales made today</p>
              <p className="font-display text-lg font-semibold">{todaySaleCount}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard icon={<ShoppingCart size={18} />} label="Total sales" value={`${currency} ${totalSales.toLocaleString()}`} tone="navy" />
          <StatCard icon={<Wallet size={18} />} label="Money collected" value={`${currency} ${moneyCollected.toLocaleString()}`} tone="success" />
          <StatCard icon={<Receipt size={18} />} label="Total expenses" value={`${currency} ${totalExpenses.toLocaleString()}`} tone="warning" />
          <StatCard
            icon={estimatedProfit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            label="Estimated profit"
            value={`${currency} ${estimatedProfit.toLocaleString()}`}
            tone={estimatedProfit >= 0 ? "success" : "danger"}
          />
          <StatCard icon={<CircleDollarSign size={18} />} label="Money owed to you" value={`${currency} ${totalMoneyOwed.toLocaleString()}`} tone="gold" />
        </div>
        <p className="text-xs -mt-6 mb-8" style={{ color: "#9CA3AF" }}>
          Profit is based on money actually collected, not sales still owed to you.
        </p>

        <div className="c-card p-5 mb-8">
          <h3 className="font-display font-semibold mb-3">Quick actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-11 gap-3">
            <NavCard href="/dashboard/search" label="Search" icon={<Search size={20} />} tone="navy" />
            <NavCard href="/dashboard/insights" label="Insights" icon={<LineChart size={20} />} tone="success" />
            <NavCard href="/dashboard/goals" label="Goals" icon={<Target size={20} />} tone="gold" />
            <NavCard href="/dashboard/cashflow" label="Cash flow" icon={<Wallet size={20} />} tone="success" />
            <NavCard href="/dashboard/recurring" label="Recurring" icon={<Repeat size={20} />} tone="warning" />
            <NavCard href="/dashboard/sales" label="Sales" icon={<ShoppingCart size={20} />} tone="navy" />
            <NavCard href="/dashboard/products" label="Products" icon={<Package size={20} />} tone="gold" />
            <NavCard href="/dashboard/expenses" label="Expenses" icon={<Receipt size={20} />} tone="warning" />
            <NavCard href="/dashboard/customers" label="Customers" icon={<Users size={20} />} tone="success" />
            <NavCard href="/dashboard/debts" label="Debts" icon={<CircleDollarSign size={20} />} tone="danger" />
            <NavCard href="/dashboard/suppliers" label="Suppliers" icon={<Truck size={20} />} tone="navy" />
            <NavCard href="/dashboard/activity" label="Activity" icon={<History size={20} />} tone="navy" />
            {profile?.role === "owner" && (
              <NavCard href="/dashboard/staff" label="Staff" icon={<UserCog size={20} />} tone="gold" />
            )}
          </div>
        </div>

        <div className="c-card p-5">
          <h3 className="font-display font-semibold mb-3">Action items</h3>
          {lowStockItems.length === 0 && outstandingDebt === 0 && !unusualExpenseSpike ? (
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Nothing needs your attention right now.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {lowStockItems.map((p) => (
                <li key={p.id} className="flex items-center gap-2" style={{ color: "var(--warning)" }}>
                  <AlertTriangle size={15} />
                  Low stock: <b>{p.name}</b> ({p.stock_quantity} left)
                </li>
              ))}
              {unusualExpenseSpike && (
                <li className="flex items-center gap-2" style={{ color: "var(--danger)" }}>
                  <AlertTriangle size={15} />
                  Expenses this month are pacing well above your usual — worth a look
                </li>
              )}
              {overdueDebts.map((d: any, i: number) => (
                <li key={i} className="flex items-center gap-2" style={{ color: "var(--danger)" }}>
                  <AlertTriangle size={15} />
                  Overdue: <b>{d.customers?.name ?? "Customer"}</b> owes {currency}{" "}
                  {(Number(d.amount_owed) - Number(d.amount_paid)).toLocaleString()}
                </li>
              ))}
              {outstandingDebt > 0 && (
                <li className="flex items-center gap-2" style={{ color: "var(--warning)" }}>
                  <AlertTriangle size={15} />
                  {currency} {outstandingDebt.toLocaleString()} owed by customers in total
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="mt-8 text-sm" style={{ color: "#9CA3AF" }}>
          No sales, expenses or products yet? That&apos;s expected — this
          dashboard will fill in automatically once your team starts
          recording them.
        </div>
      </main>
    </div>
  );
}

const TONES: Record<string, { bg: string; fg: string }> = {
  navy: { bg: "var(--navy)", fg: "white" },
  gold: { bg: "var(--gold-light)", fg: "var(--navy-dark)" },
  success: { bg: "var(--success-bg)", fg: "var(--success)" },
  danger: { bg: "var(--danger-bg)", fg: "var(--danger)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning)" },
};

function NavCard({
  href,
  label,
  icon,
  tone,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  tone: string;
}) {
  const t = TONES[tone];
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 border rounded-xl py-4 text-center text-sm font-medium hover:shadow-sm transition-shadow"
      style={{ borderColor: "var(--border-soft)" }}
    >
      <span className="c-icon-tile w-9 h-9" style={{ background: t.bg, color: t.fg }}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  const t = TONES[tone];
  return (
    <div className="c-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="c-icon-tile w-7 h-7" style={{ background: t.bg, color: t.fg }}>
          {icon}
        </span>
        <p className="text-sm" style={{ color: "#6B7280" }}>{label}</p>
      </div>
      <p className="font-display text-2xl font-semibold" style={{ color: t.fg === "white" ? "var(--foreground)" : t.fg }}>
        {value}
      </p>
    </div>
  );
}
