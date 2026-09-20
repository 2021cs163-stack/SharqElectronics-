import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useRentals, Rental, RentalUnit } from "@/hooks/use-rentals";
import { useLedger } from "@/hooks/use-ledger";
import { useAuth } from "@/hooks/use-auth";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { Package, Plus, X, Search, Clock, CheckCircle2, AlertTriangle, ChevronRight, Calendar, User, Phone, Trash2 } from "lucide-react";

type Tab = "active" | "history";

const UNIT_LABELS: Record<RentalUnit, string> = { hour: "Hour", day: "Day", week: "Week" };

export default function Rentals() {
  const { rentals, addRental, returnRental, updateRental, deleteRental, activeRentals, overdueRentals } = useRentals();
  const { tools } = useLedger();
  const { user } = useAuth();
  const { settings } = useShopSettings();
  const sym = settings.currencySymbol || "؋";

  const isPartner = user?.role === "Partner";
  const isTech = user?.role === "Tech";
  const canManage = isPartner || isTech;

  const [tab, setTab] = useState<Tab>("active");
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<Rental | null>(null);
  const [search, setSearch] = useState("");

  // Rentable tools = isRental true and not currently rented
  const rentableTools = tools.filter(t => t.isRental && !t.isCurrentlyRented && t.status === "available");

  const [form, setForm] = useState({
    toolId: "", customerName: "", customerPhone: "",
    startDate: new Date().toISOString().split("T")[0],
    startTime: new Date().toTimeString().slice(0,5),
    duration: "1", durationUnit: "day" as RentalUnit,
    deposit: "", notes: "",
  });

  const selectedTool = tools.find(t => t.id === form.toolId);
  const ratePerUnit = selectedTool
    ? (form.durationUnit === "hour" ? selectedTool.rentalRateHour
      : form.durationUnit === "day"  ? selectedTool.rentalRateDay
      : selectedTool.rentalRateWeek) || 0
    : 0;
  const totalCost = ratePerUnit * parseFloat(form.duration || "0");

  const submitRental = () => {
    if (!form.toolId || !form.customerName || !form.duration) return;
    const tool = tools.find(t => t.id === form.toolId)!;
    const dur = parseFloat(form.duration);
    // Compute endDate
    const start = new Date(form.startDate);
    if (form.durationUnit === "hour") start.setHours(start.getHours() + dur);
    else if (form.durationUnit === "day") start.setDate(start.getDate() + dur);
    else start.setDate(start.getDate() + dur * 7);
    const endDate = start.toISOString().split("T")[0];

    addRental({
      toolId: tool.id, toolName: tool.name, toolSku: tool.sku,
      customerName: form.customerName, customerPhone: form.customerPhone,
      startDate: form.startDate, startTime: form.startTime,
      duration: dur, durationUnit: form.durationUnit,
      endDate, ratePerUnit, currency: tool.rentalCurrency || "Af",
      deposit: parseFloat(form.deposit) || undefined,
      totalCost,
    }, user?.name || "Staff");

    setForm({ toolId:"", customerName:"", customerPhone:"",
      startDate: new Date().toISOString().split("T")[0],
      startTime: new Date().toTimeString().slice(0,5),
      duration:"1", durationUnit:"day", deposit:"", notes:"" });
    setShowAdd(false);
  };

  const historyRentals = rentals.filter(r => r.status === "returned");
  const displayed = tab === "active" ? activeRentals : historyRentals;
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return displayed.filter(r => !q ||
      r.customerName.toLowerCase().includes(q) ||
      r.toolName.toLowerCase().includes(q) ||
      r.rentalNo.toLowerCase().includes(q));
  }, [displayed, search]);

  const inp = "w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
  const today = new Date().toISOString().split("T")[0];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Rentals</h1>
            <p className="text-muted-foreground text-sm mt-1">Tool rentals · Active · Returns</p>
          </div>
          {canManage && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
              <Plus className="w-4 h-4"/> New Rental
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label:"Active", value: activeRentals.filter(r=>r.status==="active").length, color:"text-blue-400" },
            { label:"Overdue", value: overdueRentals.length, color:"text-red-400" },
            { label:"Returned", value: historyRentals.length, color:"text-green-400" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{s.label}</p>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
            {(["active","history"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  tab===t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>{t === "active" ? "Active" : "History"}</button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input className="w-full bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search rentals…" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3"/>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">
                {tab === "active" ? "No active rentals" : "No rental history"}
              </p>
              {tab === "active" && canManage && (
                <button onClick={() => setShowAdd(true)} className="mt-4 px-4 py-2 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs">
                  Start First Rental
                </button>
              )}
            </div>
          ) : filtered.map(r => {
            const isOverdue = r.status === "overdue";
            const daysLeft = Math.ceil((new Date(r.endDate).getTime() - new Date(today).getTime()) / 86400000);
            return (
              <div key={r.id} className={`bg-card border rounded-2xl p-4 flex items-center gap-4 transition-all ${
                isOverdue ? "border-red-700/50" : "border-border hover:border-primary/30"
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isOverdue ? "bg-red-900/20 text-red-400" : r.status==="returned" ? "bg-green-900/20 text-green-400" : "bg-blue-900/20 text-blue-400"
                }`}>
                  {isOverdue ? <AlertTriangle className="w-5 h-5"/> : r.status==="returned" ? <CheckCircle2 className="w-5 h-5"/> : <Clock className="w-5 h-5"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-black text-sm">{r.rentalNo}</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isOverdue ? "bg-red-900/40 text-red-400 border border-red-700/30"
                      : r.status==="returned" ? "bg-green-900/40 text-green-400 border border-green-700/30"
                      : "bg-blue-900/40 text-blue-400 border border-blue-700/30"
                    }`}>{isOverdue ? "Overdue" : r.status==="returned" ? "Returned" : "Active"}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground mt-0.5">{r.toolName}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="w-3 h-3"/>{r.customerName}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{r.startDate} → {r.endDate}</span>
                    {r.customerPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/>{r.customerPhone}</span>}
                  </div>
                  {r.status !== "returned" && (
                    <p className={`text-xs mt-0.5 font-bold ${isOverdue ? "text-red-400" : daysLeft <= 1 ? "text-yellow-400" : "text-muted-foreground"}`}>
                      {isOverdue ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft)!==1?"s":""} overdue` : daysLeft === 0 ? "Due today" : `${daysLeft} day${daysLeft!==1?"s":""} left`}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-primary font-black">{sym}{r.totalCost.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">{r.duration} {UNIT_LABELS[r.durationUnit]}{r.duration!==1?"s":""}</p>
                </div>
                <button onClick={() => setDetail(r)}
                  className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex-shrink-0">
                  <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ ADD RENTAL MODAL ══ */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h3 className="font-black uppercase tracking-tighter text-white text-lg">New Rental</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {rentableTools.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3"/>
                  <p className="text-sm text-muted-foreground font-bold">No rental tools available</p>
                  <p className="text-xs text-muted-foreground mt-1">Mark items as rental tools in Inventory first</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label-stencil">Tool *</label>
                    <select className={`${inp} mt-1`} value={form.toolId} onChange={e => setForm({...form, toolId:e.target.value})}>
                      <option value="">Select a rental tool…</option>
                      {rentableTools.map(t => (
                        <option key={t.id} value={t.id}>{t.name} — {sym}{t.rentalRateDay}/day</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2"><label className="label-stencil">Customer Name *</label><input className={`${inp} mt-1`} placeholder="Full name" value={form.customerName} onChange={e=>setForm({...form,customerName:e.target.value})}/></div>
                  <div><label className="label-stencil">Phone</label><input className={`${inp} mt-1`} placeholder="+93…" value={form.customerPhone} onChange={e=>setForm({...form,customerPhone:e.target.value})}/></div>
                  <div><label className="label-stencil">Deposit</label><input className={`${inp} mt-1`} type="number" min="0" placeholder={`0 ${sym}`} value={form.deposit} onChange={e=>setForm({...form,deposit:e.target.value})}/></div>
                  <div><label className="label-stencil">Start Date *</label><input className={`${inp} mt-1`} type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></div>
                  <div><label className="label-stencil">Start Time</label><input className={`${inp} mt-1`} type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></div>
                  <div><label className="label-stencil">Duration *</label><input className={`${inp} mt-1`} type="number" min="1" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/></div>
                  <div>
                    <label className="label-stencil">Unit</label>
                    <select className={`${inp} mt-1`} value={form.durationUnit} onChange={e=>setForm({...form,durationUnit:e.target.value as RentalUnit})}>
                      <option value="hour">Hour</option>
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                    </select>
                  </div>
                  {selectedTool && (
                    <div className="col-span-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground">Rate: <strong className="text-foreground">{sym}{ratePerUnit}/{form.durationUnit}</strong></p>
                      <p className="text-xl font-black text-primary mt-1">Total: {sym}{totalCost.toFixed(0)}</p>
                    </div>
                  )}
                  <div className="col-span-2"><label className="label-stencil">Notes</label><input className={`${inp} mt-1`} placeholder="Internal notes…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
                </div>
              )}
            </div>
            {rentableTools.length > 0 && (
              <div className="flex gap-3 p-6 border-t border-border flex-shrink-0">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-black uppercase tracking-tighter text-xs hover:text-white">Cancel</button>
                <button onClick={submitRental} disabled={!form.toolId || !form.customerName}
                  className="flex-[2] py-3 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs shadow-lg hover:brightness-110 disabled:opacity-40">
                  Start Rental
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ DETAIL MODAL ══ */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-black uppercase tracking-tighter text-white">{detail.rentalNo}</h3>
                <p className="text-xs text-muted-foreground">{detail.dateCreated} · {detail.createdBy}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Tool</p><p className="font-bold">{detail.toolName}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Customer</p><p className="font-bold">{detail.customerName}</p></div>
                {detail.customerPhone && <div><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Phone</p><p className="font-bold">{detail.customerPhone}</p></div>}
                <div><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Duration</p><p className="font-bold">{detail.duration} {UNIT_LABELS[detail.durationUnit]}{detail.duration!==1?"s":""}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Start</p><p className="font-bold">{detail.startDate}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Due</p><p className="font-bold">{detail.endDate}</p></div>
              </div>
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Total Cost</p>
                <p className="text-3xl font-black text-primary mt-1">{sym}{detail.totalCost.toFixed(0)}</p>
                {detail.deposit && <p className="text-xs text-muted-foreground mt-1">Deposit: {sym}{detail.deposit}</p>}
              </div>
              {detail.notes && <div><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Notes</p><p className="text-sm">{detail.notes}</p></div>}
            </div>
            <div className="flex gap-3 p-5 border-t border-border flex-shrink-0">
              {canManage && (
                <button onClick={() => { deleteRental(detail.id); setDetail(null); }}
                  className="p-3 rounded-xl border border-red-900/40 text-red-400 hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4"/>
                </button>
              )}
              {detail.status !== "returned" && canManage && (
                <button onClick={() => { returnRental(detail.id); setDetail({...detail, status:"returned", returnedDate:today}); }}
                  className="flex-1 py-3 rounded-xl bg-green-700 text-white font-black uppercase tracking-tighter text-xs hover:brightness-110">
                  Mark Returned
                </button>
              )}
              <button onClick={() => setDetail(null)} className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs">Done</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
