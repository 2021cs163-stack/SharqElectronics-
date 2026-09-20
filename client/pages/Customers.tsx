import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useBilling, CustomerProfile } from "@/hooks/use-billing";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { useAuth } from "@/hooks/use-auth";
import {
  Search, Users, Phone, Calendar,
  Trash2, Plus, X, ChevronRight, Receipt
} from "lucide-react";

export default function Customers() {
  const { customers, bills, deleteCustomer, addCustomer } = useBilling();
  const { settings } = useShopSettings();
  const { user } = useAuth();
  const isStaff = user?.role === "Staff";
  const sym = settings.currencySymbol || "؋";

  const [search,   setSearch]   = useState("");
  const [sort,     setSort]     = useState<"spent"|"visits"|"recent">("recent");
  const [detail,   setDetail]   = useState<CustomerProfile|null>(null);
  const [confirm,  setConfirm]  = useState<string|null>(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [newName,  setNewName]  = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = customers.filter(c =>
      !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
    return [...list].sort((a, b) => {
      if (sort === "spent")  return b.totalSpent - a.totalSpent;
      if (sort === "visits") return b.visitCount - a.visitCount;
      return b.lastVisit.localeCompare(a.lastVisit);
    });
  }, [customers, search, sort]);

  const customerBills = (c: CustomerProfile) =>
    bills.filter(b =>
      b.customerName.toLowerCase() === c.name.toLowerCase() ||
      (c.phone && b.customerPhone === c.phone)
    );

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const topSpender   = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];

  const inp = "w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Customers</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {customers.length} customer{customers.length!==1?"s":""}{!isStaff && ` · ${sym}${totalRevenue.toLocaleString()} total`}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-black uppercase text-xs shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
            <Plus className="w-4 h-4"/> Add Customer
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(isStaff ? [
            {label:"Total Customers", value:customers.length, color:"text-foreground"},
          ] : [
            {label:"Total Customers", value:customers.length,                    color:"text-foreground"},
            {label:"Total Revenue",   value:`${sym}${totalRevenue.toLocaleString()}`, color:"text-primary"},
            {label:"Top Spender",     value:topSpender?.name||"—",               color:"text-yellow-400"},
            {label:"Avg per Customer",value:`${sym}${customers.length>0?(totalRevenue/customers.length).toFixed(0):"0"}`, color:"text-blue-400"},
          ]).map(s=>(
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{s.label}</p>
              <p className={`text-xl font-black mt-1 truncate ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + sort */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input className="w-full bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search by name or phone…"
              value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value as any)}
            className="bg-card border border-border text-foreground rounded-xl px-3 py-2.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="recent">Sort: Recent</option>
            <option value="spent">Sort: Top Spenders</option>
            <option value="visits">Sort: Most Visits</option>
          </select>
        </div>

        {/* Customer list */}
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3"/>
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">
              {customers.length===0 ? "No customers yet" : "No customers match"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Customers are saved automatically when you enter a name at checkout.
              Or add one manually with the button above.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <div key={c.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-sm">{c.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {c.phone && c.phone!=="—" && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3"/>{c.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3"/>Last: {c.lastVisit}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.visitCount} visit{c.visitCount!==1?"s":""}</span>
                  </div>
                </div>
                {!isStaff && (
                <div className="text-right flex-shrink-0">
                  <p className="text-primary font-black text-base">{sym}{c.totalSpent.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">total spent</p>
                </div>
                )}
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={()=>setDetail(c)}
                    className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    <ChevronRight className="w-4 h-4"/>
                  </button>
                  <button onClick={()=>setConfirm(c.id)}
                    className="p-2 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Customer Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-black uppercase tracking-tighter text-white">Add Customer</h3>
              <button onClick={() => { setShowAdd(false); setNewName(""); setNewPhone(""); setNewNotes(""); }}
                className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Name *</label>
                <input className={`${inp} mt-1`} placeholder="Customer name"
                  value={newName} onChange={e=>setNewName(e.target.value)} autoFocus/>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone</label>
                <input className={`${inp} mt-1`} placeholder="+93 700 000 000"
                  value={newPhone} onChange={e=>setNewPhone(e.target.value)}/>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes</label>
                <input className={`${inp} mt-1`} placeholder="Optional notes"
                  value={newNotes} onChange={e=>setNewNotes(e.target.value)}/>
              </div>
              <button
                onClick={() => {
                  addCustomer(newName, newPhone, newNotes);
                  setShowAdd(false); setNewName(""); setNewPhone(""); setNewNotes("");
                }}
                disabled={!newName.trim()}
                className="w-full py-3 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110 disabled:opacity-40">
                Add Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-red-700/40 rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
            <Trash2 className="w-10 h-10 text-red-400 mx-auto"/>
            <p className="font-black text-foreground">Delete this customer?</p>
            <p className="text-xs text-muted-foreground">Their bill history is kept — only the profile is removed.</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-black hover:bg-muted">Cancel</button>
              <button onClick={()=>{ deleteCustomer(confirm); setConfirm(null); setDetail(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Customer detail ── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg">
                  {detail.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-white text-base">{detail.name}</h3>
                  {detail.phone && detail.phone!=="—" && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3"/>{detail.phone}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={()=>setDetail(null)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                {(isStaff ? [
                  {label:"Visits",     value:detail.visitCount, color:"text-foreground"},
                  {label:"Last Visit", value:detail.lastVisit,  color:"text-foreground"},
                ] : [
                  {label:"Total Spent",  value:`${sym}${detail.totalSpent.toLocaleString()}`, color:"text-primary"},
                  {label:"Visits",       value:detail.visitCount,   color:"text-foreground"},
                  {label:"Last Visit",   value:detail.lastVisit,    color:"text-foreground"},
                ]).map(s=>(
                  <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                    <p className={`font-black text-sm ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5"/> Purchase History
                </p>
                {customerBills(detail).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No bills found</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {customerBills(detail).map(b => (
                      <div key={b.billNo} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">{b.billNo}</p>
                          <p className="text-xs text-muted-foreground">{b.date} · {b.items.length} item{b.items.length!==1?"s":""}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-primary font-black text-sm">{sym}{b.grandTotal.toLocaleString()}</p>
                          {b.discount>0 && <p className="text-green-400 text-xs">-{sym}{b.discount.toLocaleString()}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {detail.notes && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{detail.notes}</p>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 pt-4 border-t border-border flex gap-3 flex-shrink-0">
              <button onClick={()=>setConfirm(detail.id)}
                className="p-3 rounded-xl border border-red-900/40 text-red-400 hover:bg-red-900/20">
                <Trash2 className="w-4 h-4"/>
              </button>
              <button onClick={()=>setDetail(null)}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
