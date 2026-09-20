import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useLedger } from "@/hooks/use-ledger";
import { useBilling } from "@/hooks/use-billing";
import { useFinancials, EXPENSE_LABELS } from "@/hooks/use-financials";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, TrendingUp, TrendingDown, Download, Receipt, DollarSign, Wallet } from "lucide-react";

type Period = "today" | "week" | "month" | "quarter" | "year";

function downloadCSV(rows: (string|number)[][], name: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name; a.click();
}
function downloadJSON(data: unknown, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = name; a.click();
}

function periodStart(period: Period): string {
  const d = new Date();
  if (period === "today")   { return d.toISOString().split("T")[0]; }
  if (period === "week")    { d.setDate(d.getDate()-6); }
  else if (period === "month")   { d.setDate(1); }
  else if (period === "quarter") { d.setMonth(d.getMonth()-2, 1); }
  else                           { d.setMonth(0, 1); }
  return d.toISOString().split("T")[0];
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today",   label: "Today"   },
  { key: "week",    label: "Week"    },
  { key: "month",   label: "Month"   },
  { key: "quarter", label: "Quarter" },
  { key: "year",    label: "Year"    },
];

export default function Reports() {
  const { ledger, tools } = useLedger();
  const { bills } = useBilling();
  const { expenses } = useFinancials();
  const { settings } = useShopSettings();
  const [period, setPeriod] = useState<Period>("today");
  const sym   = settings.currencySymbol || "؋";
  const today = new Date().toISOString().split("T")[0];

  const startStr = useMemo(() => periodStart(period), [period]);

  const periodBills = useMemo(() =>
    bills.filter(b => b.date >= startStr && b.date <= today),
    [bills, startStr, today]
  );

  const periodExpenses = useMemo(() =>
    expenses.filter(e => e.date >= startStr && e.date <= today),
    [expenses, startStr, today]
  );

  // Revenue
  const totalRevenue  = periodBills.reduce((s, b) =>
    s + (b.status === 'credit' ? (b.amountPaid||b.grandTotal) : b.grandTotal), 0);
  const totalCreditOwed = periodBills.filter(b=>b.status==='credit')
    .reduce((s,b) => s+(b.balance||0), 0);
  const totalDiscount = periodBills.reduce((s, b) => s + b.discount, 0);
  const avgBill       = periodBills.length > 0 ? totalRevenue / periodBills.length : 0;

  // COGS from inventory
  const inventoryCostMap = useMemo(() => {
    const bySku  = new Map<string, number>();
    const byName = new Map<string, number>();
    tools.forEach(t => {
      if (t.sku && t.sku !== "—") bySku.set(t.sku.toLowerCase(), t.costPrice);
      byName.set(t.name.toLowerCase(), t.costPrice);
    });
    return { bySku, byName };
  }, [tools]);

  const { cogs, itemsNoCost } = useMemo(() => {
    let cogs = 0, noCost = 0;
    for (const bill of periodBills) {
      for (const item of bill.items) {
        const cost =
          inventoryCostMap.bySku.get(item.sku?.toLowerCase() ?? "") ??
          inventoryCostMap.byName.get(item.name.toLowerCase()) ?? null;
        if (cost !== null) { cogs += cost * item.qty; }
        else { noCost++; }
      }
    }
    return { cogs, itemsNoCost: noCost };
  }, [periodBills, inventoryCostMap]);

  // Expenses from financial ledger
  const totalExpenses  = periodExpenses.reduce((s, e) => s + e.amountAf, 0);
  const grossProfit    = totalRevenue - cogs - totalDiscount;
  const netProfit      = grossProfit - totalExpenses;

  // Partner borrow tracking
  const partnerBorrows = periodExpenses.filter(e => e.category === 'partner_borrow');
  const totalPartnerBorrow = partnerBorrows.reduce((s,e) => s + e.amountAf, 0);
  const partnerWithdrawals = periodExpenses.filter(e => e.category === 'partner_withdrawal');
  const totalPartnerWithdrawal = partnerWithdrawals.reduce((s,e) => s + e.amountAf, 0);
  const hasMissingCost = itemsNoCost > 0;

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    periodExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amountAf);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [periodExpenses]);

  // Chart — daily revenue bars
  const chartData = useMemo(() => {
    const days = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : period === "quarter" ? 90 : 365;
    const buckets = period === "year" ? 12 : Math.min(days, 30);
    return Array.from({ length: buckets }, (_, i) => {
      const d = new Date();
      if (period === "year") {
        d.setDate(1); d.setMonth(d.getMonth() - (buckets-1-i));
        const ms = d.toISOString().slice(0, 7);
        const rev = bills.filter(b => b.date.startsWith(ms)).reduce((s,b) => s+b.grandTotal, 0);
        const exp = expenses.filter(e => e.date.startsWith(ms)).reduce((s,e) => s+e.amountAf, 0);
        return { name: d.toLocaleDateString("en-US",{month:"short"}), revenue: rev, expenses: exp };
      } else {
        d.setDate(d.getDate() - (buckets-1-i));
        const ds = d.toISOString().split("T")[0];
        const rev = bills.filter(b => b.date === ds).reduce((s,b) => s+b.grandTotal, 0);
        const exp = expenses.filter(e => e.date === ds).reduce((s,e) => s+e.amountAf, 0);
        return { name: d.toLocaleDateString("en-US",{month:"short",day:"numeric"}), revenue: rev, expenses: exp };
      }
    });
  }, [bills, expenses, period]);

  // Top selling items
  const topItems = useMemo(() => {
    const map = new Map<string, { name:string; qty:number; revenue:number }>();
    for (const b of periodBills) {
      for (const item of b.items) {
        const ex = map.get(item.name) || { name: item.name, qty: 0, revenue: 0 };
        map.set(item.name, { name: item.name, qty: ex.qty+item.qty, revenue: ex.revenue+item.total });
      }
    }
    return [...map.values()].sort((a,b) => b.revenue-a.revenue).slice(0, 8);
  }, [periodBills]);

  const periodLabel = PERIODS.find(p => p.key === period)?.label || period;

  return (
    <Layout>
      <div className="space-y-5">

        {/* Header + period switcher */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">{periodLabel} · {periodBills.length} bill{periodBills.length!==1?"s":""}</p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  period===p.key ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Revenue",    value: totalRevenue,  icon: TrendingUp,   color: "text-primary",    border: "border-l-primary" },
              ...(totalCreditOwed > 0 ? [{ label: "Credit Owed", value: totalCreditOwed, icon: TrendingUp, color: "text-orange-400", border: "border-l-orange-500" }] : []),
            { label: "Expenses",   value: totalExpenses, icon: Wallet,       color: "text-orange-400", border: "border-l-orange-500" },
              ...(totalPartnerBorrow > 0 ? [{ label: "Partner Borrow", value: totalPartnerBorrow, icon: Wallet, color: "text-yellow-400", border: "border-l-yellow-500" }] : []),
              ...(totalPartnerWithdrawal > 0 ? [{ label: "Partner Withdrawal", value: totalPartnerWithdrawal, icon: Wallet, color: "text-purple-400", border: "border-l-purple-500" }] : []),
            { label: "Gross Profit (Sales−COGS)", value: grossProfit, icon: TrendingDown, color: grossProfit>=0?"text-green-400":"text-red-400", border: grossProfit>=0?"border-l-green-500":"border-l-red-500" },
            { label: "Net Profit", value: netProfit,     icon: DollarSign,   color: netProfit>=0?"text-green-400":"text-red-400", border: netProfit>=0?"border-l-green-500":"border-l-red-500" },
          ].map(k => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`bg-card border border-border rounded-2xl p-4 border-l-4 ${k.border}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-tight">{k.label}</p>
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
                <p className={`text-2xl font-black ${k.color}`}>{sym}{k.value.toLocaleString(undefined,{maximumFractionDigits:0})}</p>
              </div>
            );
          })}
        </div>

        {/* Secondary metrics row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">COGS</p>
            <p className="text-xl font-black text-orange-400 mt-1">{sym}{cogs.toLocaleString(undefined,{maximumFractionDigits:0})}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Discounts</p>
            <p className="text-xl font-black text-yellow-400 mt-1">{sym}{totalDiscount.toLocaleString(undefined,{maximumFractionDigits:0})}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg Bill</p>
            <p className="text-xl font-black text-blue-400 mt-1">{sym}{avgBill.toLocaleString(undefined,{maximumFractionDigits:0})}</p>
          </div>
        </div>

        {hasMissingCost && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-900/20 border border-yellow-700/30">
            <span className="text-yellow-400 text-sm flex-shrink-0">⚠</span>
            <p className="text-xs text-yellow-400">
              <strong>{itemsNoCost} sold item{itemsNoCost!==1?"s":""}</strong> missing cost price — COGS and profit are understated.
              Add cost prices to inventory items.
            </p>
          </div>
        )}

        {/* Revenue vs Expenses chart */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Revenue vs Expenses — {periodLabel}
          </h2>
          {bills.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No sales yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                <XAxis dataKey="name" tick={{ fill:"hsl(var(--muted-foreground))", fontSize:10, fontWeight:700 }} axisLine={false} tickLine={false}/>
                <YAxis allowDecimals={false} tick={{ fill:"hsl(var(--muted-foreground))", fontSize:10 }} axisLine={false} tickLine={false}/>
                <Tooltip
                  contentStyle={{ background:"hsl(var(--card))", border:"1px solid hsl(var(--border))", borderRadius:12, fontSize:12, fontWeight:700 }}
                  formatter={(v:number, name:string) => [`${sym}${v.toLocaleString()}`, name === "revenue" ? "Revenue" : "Expenses"]}
                />
                <Bar dataKey="revenue"  fill="hsl(var(--primary))" radius={[4,4,0,0]}/>
                <Bar dataKey="expenses" fill="#f97316" radius={[4,4,0,0]} opacity={0.7}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top items + expenses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top selling items */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Top Items — {periodLabel}</h3>
            </div>
            {topItems.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No sales in this period</p>
            ) : topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 px-5 py-3 border-b border-border/40 last:border-0">
                <span className="text-base font-black text-muted-foreground/40 w-5">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">×{item.qty} sold</p>
                </div>
                <span className="text-sm font-black text-primary flex-shrink-0">{sym}{item.revenue.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
              </div>
            ))}
          </div>

          {/* Expense breakdown */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Expenses — {periodLabel}</h3>
            </div>
            {expenseByCategory.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No expenses in this period</p>
            ) : expenseByCategory.map(([cat, amt]) => (
              <div key={cat} className="flex items-center gap-3 px-5 py-3 border-b border-border/40 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground capitalize">{EXPENSE_LABELS[cat as any] || cat}</p>
                </div>
                <span className="text-sm font-black text-orange-400 flex-shrink-0">{sym}{amt.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
              </div>
            ))}
            {expenseByCategory.length > 0 && (
              <div className="flex items-center gap-3 px-5 py-3 bg-muted/20">
                <p className="flex-1 text-sm font-black text-foreground">Total</p>
                <span className="text-sm font-black text-orange-400">{sym}{totalExpenses.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
              </div>
            )}
          </div>
        </div>

        {/* Export buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Sales CSV",
              fn: () => downloadCSV(
                [["Bill No","Date","Customer","Items","Subtotal","Discount","Total"],
                 ...periodBills.map(b => [b.billNo,b.date,b.customerName,b.items.length,b.subtotal.toFixed(0),b.discount.toFixed(0),b.grandTotal.toFixed(0)])],
                `sales-${period}-${today}.csv`
              )
            },
            {
              label: "Expenses CSV",
              fn: () => downloadCSV(
                [["Date","Category","Description","Amount (Af)"],
                 ...periodExpenses.map(e => [e.date,e.category,e.description,e.amountAf.toFixed(0)])],
                `expenses-${period}-${today}.csv`
              )
            },
            {
              label: "Daily Close",
              fn: () => {
                const t = ledger.filter(e => e.date === today);
                downloadJSON({ date:today, generatedAt:new Date().toISOString(), revenue:totalRevenue, expenses:totalExpenses, netProfit, entries:t }, `close-${today}.json`);
              }
            },
            {
              label: "Full Audit",
              fn: () => downloadCSV(
                [["ID","Date","Time","User","Action","Tool","Status","Notes"],
                 ...ledger.map(e => [e.id,e.date,e.timestamp,e.userName,e.action,e.toolName,e.status,e.notes||""])],
                `audit-${today}.csv`
              )
            },
          ].map(btn => (
            <button key={btn.label} onClick={btn.fn}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border text-foreground font-black uppercase tracking-tighter text-xs hover:border-primary/40 hover:text-primary transition-all">
              <Download className="w-4 h-4" /> {btn.label}
            </button>
          ))}
        </div>

      </div>
    </Layout>
  );
}
