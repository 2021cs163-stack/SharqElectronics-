import { appStorage, flushCloudData } from '@/lib/app-storage';
import { supabaseConfigured } from '@/lib/supabase';
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useBilling, Bill } from "@/hooks/use-billing";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { CheckoutModal } from "@/components/modals/CheckoutModal";
import { useAuth } from "@/hooks/use-auth";
import {
  Search, Plus, Printer, X, Receipt, Phone,
  ChevronRight, AlertCircle, CheckCircle2, DollarSign
} from "lucide-react";

type Period = "today" | "week" | "month" | "all";

function buildReprintHTML(bill: Bill, sym: string, shopName: string, shopPhone: string, footer: string) {
  const itemRows = bill.items.map(item =>
    `<tr>
      <td><div class="ititle">${item.name}</div></td>
      <td class="iqty">${item.qty}</td>
      <td class="irate">${sym}${item.unitPrice.toFixed(0)}</td>
      <td class="iamt">${sym}${item.total.toFixed(0)}</td>
    </tr>`
  ).join('');
  const discountRow = bill.discount > 0
    ? `<div class="trow"><span>Subtotal</span><span>${sym}${bill.subtotal.toFixed(0)}</span></div>
       <div class="trow disc"><span>Discount</span><span>-${sym}${bill.discount.toFixed(0)}</span></div><hr class="dash">`
    : '';
  const creditRows = bill.status === 'credit'
    ? `<div class="creditrow"><span>PAID</span><span>${sym}${(bill.amountPaid||0).toFixed(0)}</span></div>
       <div class="owesrow"><span>OWES</span><span>${sym}${(bill.balance||0).toFixed(0)}</span></div>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:288px;background:#fff;color:#000;font-family:'Courier New',monospace;font-size:11px;line-height:1.4;overflow:hidden}
.w{width:288px;padding:10px 10px 24px 10px}
.sname{font-size:36px;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
.sphone{font-size:18px;text-align:center;margin-bottom:3px}
.thick{border:none;border-top:2px solid #000;margin:5px 0}
.dash{border:none;border-top:1px dashed #666;margin:4px 0}
table{width:100%;border-collapse:collapse;margin:3px 0}
thead th{font-size:17px;text-transform:uppercase;font-weight:900;padding:3px 0;border-bottom:1.5px solid #000;text-align:left}
th.rqty,td.iqty{width:15px;text-align:center}
th.rrate,td.irate{width:35px;text-align:right}
th.ramt,td.iamt{width:35px;text-align:right;font-weight:bold}
td{vertical-align:top;padding:2px 0}
.ititle{font-size:22px;font-weight:bold;line-height:1.2}
.trow{display:flex;justify-content:space-between;font-size:20px;padding:1px 0}
.grandrow{display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid #000;padding:4px 0 2px;margin-top:2px}
.glabel{font-size:30px;font-weight:900;text-transform:uppercase}
.gamount{font-size:44px;font-weight:900}
.creditrow{display:flex;justify-content:space-between;font-size:22px;font-weight:900;color:#e65100;padding:2px 0;border-top:1px dashed #ccc;margin-top:4px}
.owesrow{display:flex;justify-content:space-between;font-size:22px;font-weight:900;color:#c62828;padding:2px 0}
.footer{text-align:center;font-size:18px;line-height:1.7;margin-top:6px}
</style></head><body><div class="w">
<div class="sname">${shopName}</div>
${shopPhone ? `<div class="sphone">${shopPhone}</div>` : ''}
<hr class="thick">
<div style="display:flex;justify-content:space-between;margin:3px 0">
  <div><div style="font-size:13px;color:#777;text-transform:uppercase">Invoice</div>
  <div style="font-size:19px;font-weight:900">${bill.billNo}</div></div>
  <div style="text-align:right"><div style="font-size:17px;font-weight:bold">${bill.date}</div>
  <div style="font-size:15px;color:#555">${bill.time}</div></div>
</div>
<div style="font-size:16px;font-weight:bold;margin:2px 0">Customer: ${bill.customerName}</div>
<hr class="dash">
<table>
  <thead><tr><th>Item</th><th class="rqty">Qty</th><th class="rrate">Rate</th><th class="ramt">Amt</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<hr class="dash">
${discountRow}
<div class="grandrow"><span class="glabel">Total</span><span class="gamount">${sym}${bill.grandTotal.toFixed(0)}</span></div>
${creditRows}
<div class="footer">${footer || 'Thank you!'}</div>
</div></body></html>`;
}

export default function Billing() {
  const { bills, markBillPaid } = useBilling();
  const { settings } = useShopSettings();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [search,  setSearch]  = useState("");
  const [detail,  setDetail]  = useState<Bill|null>(null);
  const [period,  setPeriod]  = useState<Period>("today");
  const [tab,     setTab]     = useState<"all"|"credit">("all");
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState<{ok:boolean;text:string}|null>(null);
  const [payInput,   setPayInput]   = useState("");
  const [editBill,   setEditBill]   = useState<Bill|null>(null);
  const [editItems,  setEditItems]  = useState<any[]>([]);

  const { user } = useAuth();
  const isTech    = user?.role === 'Tech';
  const isPartner = user?.role === 'Partner';
  const canCollect = isPartner || isTech; // Staff cannot collect credit payments
  const sym       = settings.currencySymbol || "؋";
  const today     = new Date().toISOString().split("T")[0];
  const shopName  = settings.shopName  || "Sharq Electronics";
  const shopPhone = settings.shopPhone || "";
  const footer    = settings.receiptFooter || "Thank you!";

  const inPeriod = (dateStr: string) => {
    if (period === "all")   return true;
    if (period === "today") return dateStr === today;
    if (period === "week") {
      const diff = (Date.now() - new Date(dateStr).getTime()) / 86400000;
      return diff <= 7;
    }
    return dateStr.startsWith(today.slice(0, 7));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bills
      .filter(b => inPeriod(b.date))
      .filter(b => tab === "credit" ? b.status === "credit" : true)
      .filter(b => !q || b.billNo.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.customerPhone?.includes(q))
      .sort((a, b) => b.billNo.localeCompare(a.billNo));
  }, [bills, search, period, tab]);

  // Credit bills stats
  const creditBills   = bills.filter(b => b.status === "credit");
  const totalOwed     = creditBills.reduce((s, b) => s + (b.balance||0), 0);
  const periodRevenue = filtered.filter(b=>b.status==='paid').reduce((s,b) => s+b.grandTotal, 0)
                      + filtered.filter(b=>b.status==='credit').reduce((s,b) => s+(b.amountPaid||0), 0);

  const handleReprint = async (bill: Bill) => {
    if (printing) return;
    const html     = buildReprintHTML(bill, sym, shopName, shopPhone, footer);
    const billData = {
      shopName, shopPhone,
      billNo: bill.billNo, date: bill.date, time: bill.time,
      createdBy: bill.createdBy, customerName: bill.customerName,
      customerPhone: bill.customerPhone, items: bill.items,
      subtotal: bill.subtotal, discount: bill.discount, grandTotal: bill.grandTotal,
      amountPaid: bill.amountPaid, balance: bill.balance, status: bill.status,
      currencySymbol: sym, receiptFooter: footer,
    };
    setPrinting(true);
    try {
      const res = await fetch('/api/print-bill', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ bill: { id: bill.billNo, data: billData, html } }),
      });
      const data = await res.json();
      setPrintMsg({ ok: data.ok, text: data.ok ? '✓ Printed' : data.message });
    } catch {
      setPrintMsg({ ok: false, text: 'Printer not connected' });
    } finally {
      setPrinting(false);
      setTimeout(() => setPrintMsg(null), 4000);
    }
  };

  const handleMarkPaid = (bill: Bill, amount?: number) => {
    markBillPaid(bill.billNo, amount);
    setDetail(prev => prev ? { ...prev, balance: Math.max(0,(prev.balance||0)-(amount??prev.balance??0)), status: 'paid' } : null);
    setPayInput("");
  };

  const PERIODS: {key:Period;label:string}[] = [
    {key:"today",label:"Today"},{key:"week",label:"Week"},
    {key:"month",label:"Month"},{key:"all",label:"All"},
  ];

  return (
    <Layout>
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />

      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase text-foreground">Billing</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {filtered.length} bill{filtered.length!==1?"s":""} · {sym}{periodRevenue.toLocaleString()} collected
            </p>
          </div>
          <button onClick={() => setCheckoutOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-black uppercase text-sm shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
            <Plus className="w-4 h-4"/> New Sale
          </button>
        </div>

        {/* Credit alert — shown only when bills are outstanding */}
        {creditBills.length > 0 && (
          <button onClick={() => { setTab("credit"); setPeriod("all"); }}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-orange-900/20 border border-orange-700/40 hover:border-orange-600/60 transition-colors text-left">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0"/>
            <div className="flex-1">
              <p className="text-orange-400 font-black text-sm">
                {creditBills.length} credit bill{creditBills.length!==1?"s":""} unpaid
              </p>
              <p className="text-xs text-muted-foreground">Total owed: {sym}{totalOwed.toLocaleString()}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground"/>
          </button>
        )}

        {/* Tabs + Period + Search */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* All / Credit tabs */}
          <div className="flex bg-card border border-border rounded-xl overflow-hidden flex-shrink-0">
            <button onClick={() => setTab("all")}
              className={`px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors
                ${tab==="all" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              All
            </button>
            <button onClick={() => setTab("credit")}
              className={`px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1
                ${tab==="credit" ? "bg-orange-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>
              Credit {creditBills.length > 0 && <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black ${tab==="credit"?"bg-white text-orange-500":"bg-orange-500 text-white"}`}>{creditBills.length}</span>}
            </button>
          </div>
          {/* Period pills */}
          <div className="flex bg-card border border-border rounded-xl overflow-hidden flex-shrink-0">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors
                  ${period===p.key ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input
              className="w-full bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search…"
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          {printMsg && (
            <span className={`text-xs font-bold px-3 py-2 rounded-xl border flex-shrink-0
              ${printMsg.ok ? "text-green-400 bg-green-900/20 border-green-700/30" : "text-red-400 bg-red-900/20 border-red-700/30"}`}>
              {printMsg.text}
            </span>
          )}
        </div>

        {/* Bills list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3"/>
              <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">
                {period==="today" && tab==="all" ? "No sales today yet" : "No bills found"}
              </p>
              {period==="today" && tab==="all" && (
                <button onClick={() => setCheckoutOpen(true)}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110">
                  Start a Sale
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(bill => (
                <div key={bill.billNo}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-primary/[0.02] transition-colors
                    ${bill.status==='credit' ? 'border-l-2 border-l-orange-500' : ''}`}>
                  <div className="flex-shrink-0 w-20">
                    <p className="text-xs font-black text-foreground font-mono">{bill.billNo}</p>
                    <p className="text-[10px] text-muted-foreground">{bill.date===today?"Today":bill.date}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{bill.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {bill.items.length} item{bill.items.length!==1?"s":""}
                      {bill.customerPhone && bill.customerPhone!=="—" &&
                        <span className="ml-2 inline-flex items-center gap-0.5"><Phone className="w-2.5 h-2.5"/>{bill.customerPhone}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black text-primary">{sym}{bill.grandTotal.toLocaleString()}</p>
                    {bill.status==='credit' && (
                      <p className="text-[10px] text-orange-400 font-black">owes {sym}{(bill.balance||0).toLocaleString()}</p>
                    )}
                    {bill.status==='paid' && bill.discount>0 && (
                      <p className="text-[10px] text-green-400">-{sym}{bill.discount.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {bill.status==='credit' && (
                      <button onClick={() => { setDetail(bill); setPayInput(String(bill.balance||'')); }}
                        title="Collect payment"
                        className="p-2 rounded-lg bg-orange-900/30 text-orange-400 hover:bg-orange-900/50 transition-colors">
                        <DollarSign className="w-3.5 h-3.5"/>
                      </button>
                    )}
                    <button onClick={() => handleReprint(bill)} title="Print" disabled={printing}
                      className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-white disabled:opacity-40 transition-colors">
                      <Printer className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={() => { setDetail(bill); setPayInput(String(bill.balance||'')); }}
                      className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bill detail modal ── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-white">{detail.billNo}</h3>
                  {detail.status==='credit' ? (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-900/40 text-orange-400">Credit</span>
                  ) : (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">Paid</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{detail.date} · {detail.time} · {detail.createdBy}</p>
              </div>
              <button onClick={() => { setDetail(null); setPayInput(""); }} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Customer */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
                  {detail.customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">{detail.customerName}</p>
                  {detail.customerPhone && detail.customerPhone!=="—" && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3"/>{detail.customerPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="rounded-xl bg-muted/30 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 text-[10px] font-black uppercase text-muted-foreground">Item</th>
                      <th className="text-center px-2 py-2 text-[10px] font-black uppercase text-muted-foreground">Qty</th>
                      <th className="text-right px-3 py-2 text-[10px] font-black uppercase text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{sym}{item.unitPrice.toFixed(0)} each</p>
                        </td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{item.qty}</td>
                        <td className="px-3 py-2 text-right font-bold text-foreground">{sym}{item.total.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1.5">
                {detail.discount > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{sym}{detail.subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-400">Discount</span>
                      <span className="text-green-400">−{sym}{detail.discount.toFixed(0)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-lg font-black border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">{sym}{detail.grandTotal.toFixed(0)}</span>
                </div>
                {detail.status==='credit' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid so far</span>
                      <span className="text-green-400">{sym}{(detail.amountPaid||0).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-orange-400 border-t border-orange-700/30 pt-2">
                      <span>Still Owes</span>
                      <span>{sym}{(detail.balance||0).toFixed(0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Collect payment section — Partner + Tech only */}
              {detail.status==='credit' && canCollect && (
                <div className="bg-orange-900/10 border border-orange-700/30 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-black uppercase tracking-widest text-orange-400">Collect Payment</p>
                  <div className="flex gap-2">
                    <input
                      type="number" min="1" step="1"
                      value={payInput}
                      onChange={e => setPayInput(e.target.value)}
                      placeholder={`Max: ${sym}${detail.balance?.toFixed(0)}`}
                      className="flex-1 bg-input border border-border text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={() => handleMarkPaid(detail, parseFloat(payInput)||detail.balance||0)}
                      disabled={!payInput || parseFloat(payInput) <= 0}
                      className="px-4 py-2 rounded-xl bg-orange-500 text-white font-black text-xs uppercase hover:brightness-110 disabled:opacity-40">
                      Collect
                    </button>
                  </div>
                  <button
                    onClick={() => handleMarkPaid(detail)}
                    className="w-full py-2.5 rounded-xl bg-green-600 text-white font-black text-xs uppercase hover:brightness-110 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4"/> Mark Fully Paid ({sym}{(detail.balance||0).toFixed(0)})
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-border flex gap-3 flex-shrink-0">
              <button onClick={() => handleReprint(detail)} disabled={printing}
                className="flex-1 py-3 rounded-xl border border-border text-foreground font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-muted disabled:opacity-40">
                <Printer className="w-4 h-4"/> {printing ? "Printing…" : "Reprint"}
              </button>
              {isTech && (
                <button onClick={() => { setEditBill(detail); setEditItems([...detail.items]); setDetail(null); }}
                  className="flex-1 py-3 rounded-xl border border-green-700/40 text-green-400 font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-green-900/20">
                  Edit Bill
                </button>
              )}
              <button onClick={() => { setDetail(null); setPayInput(""); }}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tech: Edit Bill Modal ── */}
      {editBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-green-700/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-black text-green-400">Edit Bill — {editBill.billNo}</h3>
                <p className="text-xs text-muted-foreground">Tech edit · changes saved to this bill</p>
              </div>
              <button onClick={() => setEditBill(null)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              {editItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <input
                      className="w-full bg-input border border-border text-foreground rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-green-500"
                      value={item.name}
                      onChange={e => setEditItems(prev => prev.map((it,j) => j===i ? {...it, name: e.target.value} : it))}
                    />
                  </div>
                  <input type="number" min="0.1" step="0.1"
                    className="w-14 bg-input border border-border text-foreground rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={item.qty}
                    onChange={e => setEditItems(prev => prev.map((it,j) => j===i ? {...it, qty: parseFloat(e.target.value)||1, total: (parseFloat(e.target.value)||1)*it.unitPrice} : it))}
                  />
                  <input type="number" min="0" step="1"
                    className="w-20 bg-input border border-border text-foreground rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={item.unitPrice}
                    onChange={e => setEditItems(prev => prev.map((it,j) => j===i ? {...it, unitPrice: parseFloat(e.target.value)||0, total: (parseFloat(e.target.value)||0)*it.qty} : it))}
                  />
                  <button onClick={() => setEditItems(prev => prev.filter((_,j) => j!==i))}
                    className="text-red-400 hover:text-red-300 flex-shrink-0">
                    <X className="w-4 h-4"/>
                  </button>
                </div>
              ))}
              <button onClick={() => setEditItems(prev => [...prev, {id:`EDIT-${Date.now()}`,name:'',sku:'—',qty:1,unitPrice:0,total:0}])}
                className="w-full py-2 rounded-xl border border-dashed border-border text-muted-foreground text-xs font-black uppercase hover:border-green-500 hover:text-green-400">
                + Add Item
              </button>
            </div>
            <div className="px-5 pb-5 pt-3 border-t border-border flex gap-3">
              <button onClick={() => setEditBill(null)} className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-black uppercase text-xs hover:text-white">
                Cancel
              </button>
              <button
                onClick={() => {
                  // Save edited items back to bill in localStorage
                  const newSub = editItems.reduce((s,it)=>s+it.total,0);
                  const updated = {...editBill, items: editItems, subtotal: newSub, grandTotal: newSub - (editBill.discount||0)};
                  const stored = JSON.parse(appStorage.getItem('shopshield_bills')||'[]');
                  const newBills = stored.map((b:any) => b.billNo === editBill.billNo ? updated : b);
                  appStorage.setItem('shopshield_bills', JSON.stringify(newBills));
                  void flushCloudData().then(() => window.location.reload()).catch(() => {});
                }}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-black uppercase text-xs hover:brightness-110">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
