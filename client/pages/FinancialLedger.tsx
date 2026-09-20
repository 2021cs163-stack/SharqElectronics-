import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useBilling } from "@/hooks/use-billing";
import { useFinancials, EXPENSE_LABELS, ExpenseCategory, Expense } from "@/hooks/use-financials";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { useAuth } from "@/hooks/use-auth";
import {
  Plus, X, Download, TrendingUp, TrendingDown,
  DollarSign, Users, ShoppingCart, Calendar, Search,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2
} from "lucide-react";

const CATS: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: 'purchase',           label: 'Stock Purchase',        color: 'text-blue-400'   },
  { value: 'rent',               label: 'Rent',                  color: 'text-orange-400' },
  { value: 'electricity',        label: 'Electricity',           color: 'text-yellow-400' },
  { value: 'salary',             label: 'Staff Salary',          color: 'text-purple-400' },
  { value: 'transport',          label: 'Transport',             color: 'text-cyan-400'   },
  { value: 'maintenance',        label: 'Maintenance',           color: 'text-red-400'    },
  { value: 'supplies',           label: 'Shop Supplies',         color: 'text-pink-400'   },
  { value: 'partner_withdrawal', label: 'Partner Withdrawal',    color: 'text-primary'    },
  { value: 'partner_borrow',     label: 'Partner Borrow',        color: 'text-orange-400' },
  { value: 'partner_credit',     label: 'Partner Investment',    color: 'text-green-400'  },
  { value: 'staff_advance',      label: 'Staff Advance',         color: 'text-indigo-400' },
  { value: 'other',              label: 'Other',                 color: 'text-muted-foreground' },
];

type LedgerRow =
  | { kind: 'sale';    date: string; id: string; desc: string; amount: number; by: string; cat: string }
  | { kind: 'expense'; date: string; id: string; desc: string; amount: number; by: string; cat: string; catColor: string };

export default function FinancialLedger() {
  const { bills } = useBilling();
  const { expenses, addExpense, deleteExpense } = useFinancials();
  const { settings } = useShopSettings();
  const { user, users } = useAuth();
  const sym = settings.currencySymbol || '؋';
  const usdRate = settings.usdRate || 70;
  const today = new Date().toISOString().split('T')[0];

  const [tab, setTab] = useState<'all' | 'income' | 'expenses'>('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(today);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add expense form
  const [eDesc,     setEDesc]     = useState('');
  const [eAmount,   setEAmount]   = useState('');
  const [eCat,      setECat]      = useState<ExpenseCategory>('purchase');
  const [eCur,      setECur]      = useState<'Af'|'USD'>('Af');
  const [eDate,     setEDate]     = useState(today);
  const [eLinked,   setELinked]   = useState('');

  const partners = users.filter(u => u.role === 'Partner' && u.active !== false);

  const handleAddExpense = () => {
    if (!eDesc.trim() || !eAmount) return;
    const amount = parseFloat(eAmount);
    if (isNaN(amount) || amount <= 0) return;
    const amountAf = eCur === 'USD' ? amount * usdRate : amount;
    addExpense({
      date: eDate, category: eCat, description: eDesc.trim(),
      amount, currency: eCur, amountAf,
      paidBy: user?.name, paidById: user?.id,
      linkedUserId: eLinked || undefined,
      linkedUserName: eLinked ? users.find(u => u.id === eLinked)?.name : undefined,
    });
    setEDesc(''); setEAmount(''); setELinked('');
    setShowAddExpense(false);
  };

  // Merged rows for the ledger view
  const allRows: LedgerRow[] = useMemo(() => {
    const rows: LedgerRow[] = [];
    bills.forEach(b => {
      if (b.date >= fromDate && b.date <= toDate) {
        rows.push({ kind: 'sale', date: b.date, id: b.billNo,
          desc: b.status === 'credit'
            ? `Credit Sale — ${b.customerName} (owes ${sym}${(b.balance||0).toFixed(0)})`
            : `Sale — ${b.customerName} (${b.items.length} items)`,
          amount: b.status === 'credit' ? (b.amountPaid||0) : b.grandTotal,
          by: b.createdBy, cat: b.status === 'credit' ? 'Credit' : 'Sale' });
      }
    });
    expenses.forEach(e => {
      if (e.date >= fromDate && e.date <= toDate) {
        const cfg = CATS.find(c => c.value === e.category);
        rows.push({ kind: 'expense', date: e.date, id: e.id,
          desc: e.linkedUserName ? `${e.description} — ${e.linkedUserName}` : e.description,
          amount: e.amountAf, by: e.paidBy || '?',
          cat: EXPENSE_LABELS[e.category], catColor: cfg?.color || 'text-muted-foreground' });
      }
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [bills, expenses, fromDate, toDate]);

  const filtered = useMemo(() => allRows.filter(r => {
    if (tab === 'income' && r.kind !== 'sale') return false;
    if (tab === 'expenses' && r.kind !== 'expense') return false;
    if (catFilter !== 'all' && r.cat !== catFilter) return false;
    const q = search.toLowerCase();
    return !q || r.desc.toLowerCase().includes(q) || r.by.toLowerCase().includes(q);
  }), [allRows, tab, catFilter, search]);

  // Grouped by date
  const grouped = useMemo(() => {
    const map: Record<string, LedgerRow[]> = {};
    filtered.forEach(r => { (map[r.date] ??= []).push(r); });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  // Summary
  const totalIncome = useMemo(() =>
    allRows.filter(r => r.kind === 'sale').reduce((s, r) => s + r.amount, 0), [allRows]);
  const totalExpenses = useMemo(() =>
    allRows.filter(r => r.kind === 'expense').reduce((s, r) => s + r.amount, 0), [allRows]);
  const netProfit = totalIncome - totalExpenses;

  // Expense breakdown by category
  const expBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.filter(e => e.date >= fromDate && e.date <= toDate)
      .forEach(e => { map[e.category] = (map[e.category] || 0) + e.amountAf; });
    return Object.entries(map).sort(([,a],[,b]) => b - a);
  }, [expenses, fromDate, toDate]);

  const exportCSV = () => {
    const rows = [
      ['Date','Type','Description','Category','Amount (Af)','By'],
      ...filtered.map(r => [r.date, r.kind==='sale'?'Income':'Expense', r.desc, r.cat, r.amount.toFixed(0), r.by]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = `ledger-${fromDate}-to-${toDate}.csv`; a.click();
  };

  const inp = "w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Layout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase text-foreground">Financial Ledger</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Income · Expenses · Profit — all in one place</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-xs font-black text-muted-foreground hover:text-foreground hover:border-primary/40 uppercase">
              <Download className="w-3.5 h-3.5"/> Export
            </button>
            <button onClick={() => setShowAddExpense(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-black uppercase text-xs shadow-lg shadow-primary/20 hover:brightness-110">
              <Plus className="w-4 h-4"/> Add Expense
            </button>
          </div>
        </div>

        {/* Date range */}
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">From</p>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="bg-input border border-border text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">To</p>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="bg-input border border-border text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
          </div>
          {[
            { label: 'Today',  fn: () => { setFromDate(today); setToDate(today); } },
            { label: 'Week',   fn: () => { const d=new Date();d.setDate(d.getDate()-6);setFromDate(d.toISOString().split('T')[0]);setToDate(today); } },
            { label: 'Month',  fn: () => { const d=new Date();d.setDate(1);setFromDate(d.toISOString().split('T')[0]);setToDate(today); } },
            { label: 'All',    fn: () => { setFromDate('2020-01-01');setToDate(today); } },
          ].map(q => (
            <button key={q.label} onClick={q.fn}
              className="px-3 py-2 rounded-xl border border-border text-xs font-black uppercase text-muted-foreground hover:border-primary/40 hover:text-foreground self-end">
              {q.label}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 border-l-4 border-l-green-500">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Income</p>
            <p className="text-2xl font-black text-green-400 mt-1">{sym}{totalIncome.toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 border-l-4 border-l-red-500">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expenses</p>
            <p className="text-2xl font-black text-red-400 mt-1">{sym}{totalExpenses.toLocaleString()}</p>
          </div>
          <div className={`bg-card border border-border rounded-2xl p-4 border-l-4 ${netProfit>=0?'border-l-primary':'border-l-orange-500'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Net Profit</p>
            <p className={`text-2xl font-black mt-1 ${netProfit>=0?'text-primary':'text-orange-400'}`}>{sym}{netProfit.toLocaleString()}</p>
          </div>
        </div>

        {/* Expense breakdown bar */}
        {expBreakdown.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Expense Breakdown</p>
            <div className="space-y-2">
              {expBreakdown.map(([cat, amt]) => {
                const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                const cfg = CATS.find(c => c.value === cat);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <p className={`text-xs font-bold w-36 flex-shrink-0 ${cfg?.color || 'text-muted-foreground'}`}>{EXPENSE_LABELS[cat as ExpenseCategory]}</p>
                    <div className="flex-1 bg-muted/30 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-primary" style={{width:`${pct}%`}}/>
                    </div>
                    <p className="text-xs font-black text-foreground w-24 text-right">{sym}{amt.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-card border border-border rounded-xl overflow-hidden flex-shrink-0">
            {(['all','income','expenses'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-black uppercase transition-all ${tab===t?'bg-primary text-white':'text-muted-foreground hover:text-foreground'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input className="w-full bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search description, name…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>

        {/* Ledger grouped by date */}
        {grouped.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3"/>
            <p className="text-muted-foreground text-sm">No transactions in this period</p>
          </div>
        ) : grouped.map(([date, rows]) => {
          const dayIncome  = rows.filter(r=>r.kind==='sale').reduce((s,r)=>s+r.amount,0);
          const dayExpense = rows.filter(r=>r.kind==='expense').reduce((s,r)=>s+r.amount,0);
          return (
            <div key={date} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/10 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-black text-foreground">{date}</p>
                <div className="flex items-center gap-4 text-xs">
                  {dayIncome > 0 && <span className="text-green-400 font-black">+{sym}{dayIncome.toLocaleString()}</span>}
                  {dayExpense > 0 && <span className="text-red-400 font-black">-{sym}{dayExpense.toLocaleString()}</span>}
                  <span className="text-muted-foreground">{rows.length} entries</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {rows.map(r => (
                  <div key={r.id}>
                    <button onClick={() => setExpandedId(expandedId===r.id?null:r.id)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-primary/[0.02] transition-colors text-left">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        r.kind==='sale' ? 'bg-green-900/30' : 'bg-red-900/30'
                      }`}>
                        {r.kind==='sale'
                          ? <TrendingUp className="w-4 h-4 text-green-400"/>
                          : <TrendingDown className="w-4 h-4 text-red-400"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{r.desc}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-black uppercase ${r.kind==='sale'?'text-green-400':(r as any).catColor||'text-muted-foreground'}`}>{r.cat}</span>
                          <span className="text-[10px] text-muted-foreground">by {r.by}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-center gap-2">
                        <div>
                          <p className={`text-sm font-black ${r.kind==='sale'?'text-green-400':'text-red-400'}`}>
                            {r.kind==='sale'?'+':'-'}{sym}{r.amount.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{r.id}</p>
                        </div>
                        {expandedId===r.id ? <ChevronUp className="w-4 h-4 text-muted-foreground"/> : <ChevronDown className="w-4 h-4 text-muted-foreground"/>}
                      </div>
                    </button>
                    {expandedId===r.id && r.kind==='expense' && (
                      <div className="px-5 pb-4 pt-1 bg-muted/10 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Category: <strong>{r.cat}</strong> · Recorded by: <strong>{r.by}</strong>
                        </p>
                        {user?.role === 'Partner' && (
                          <button onClick={() => deleteExpense(r.id)}
                            className="text-[10px] px-3 py-1 rounded-lg border border-red-700/30 text-red-400 font-black uppercase hover:bg-red-900/20">
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      </div>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-black uppercase tracking-tighter text-white">Add Expense</h3>
              <button onClick={() => setShowAddExpense(false)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</label>
                                <select value={eCat} onChange={e => setECat(e.target.value as ExpenseCategory)}
                  className="w-full bg-input border border-border text-foreground rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {CATS
                    .filter(c => {
                      // Partner-only categories
                      if (['partner_withdrawal','partner_borrow','partner_credit','staff_advance'].includes(c.value))
                        return user?.role === 'Partner';
                      return true;
                    })
                    .map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description *</label>
                <input className={`${inp} mt-1`} placeholder="What was this expense for?" value={eDesc} onChange={e=>setEDesc(e.target.value)}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount *</label>
                  <input type="number" min="0" className={`${inp} mt-1`} placeholder="0" value={eAmount} onChange={e=>setEAmount(e.target.value)}/>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Currency</label>
                  <select value={eCur} onChange={e=>setECur(e.target.value as 'Af'|'USD')} className={`${inp} mt-1`}>
                    <option value="Af">Afghani (Af)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</label>
                <input type="date" className={`${inp} mt-1`} value={eDate} onChange={e=>setEDate(e.target.value)}/>
              </div>
              {(eCat === 'partner_withdrawal' || eCat === 'partner_borrow' || eCat === 'partner_credit' || eCat === 'staff_advance') && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">For Person</label>
                  <select value={eLinked} onChange={e=>setELinked(e.target.value)} className={`${inp} mt-1`}>
                    <option value="">Select person…</option>
                    {users.filter(u=>u.active!==false).map(u=>(
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}
              <button onClick={handleAddExpense} disabled={!eDesc.trim()||!eAmount}
                className="w-full py-3 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110 disabled:opacity-40">
                Add Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
