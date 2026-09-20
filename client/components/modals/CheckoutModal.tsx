import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Minus, Trash2, User, Phone, FileText,
  Printer, CheckCircle2, ArrowLeft, Tag, Receipt, Search,
  Package, Scale, DollarSign
} from 'lucide-react';
import { useBilling, Bill, BillItem } from '@/hooks/use-billing';
import { useScanner } from '@/hooks/use-scanner';
import { useLedger, Tool } from '@/hooks/use-ledger';
import { useAuth } from '@/hooks/use-auth';
import { useShopSettings } from '@/hooks/use-shop-settings';

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillCustomer?: { name: string; phone: string } | null;
}

interface CartItem {
  id: string; name: string; sku: string;
  qty: number; unitPrice: number; grams?: number;
  minPrice?: number; maxPrice?: number;
  unit?: string;        // meter, kg, piece etc.
  stockRemaining?: number; // current stock level shown as hint
}

const WEIGHTED_KEYWORDS = ['screw','nut','bolt','nail','washer','pin','peg','rivet','bulk',
  'پیچ','میخ','سوراخ','دانه','کیلو','گرام'];

function isWeighted(name: string, sku = ''): boolean {
  const n = (name + sku).toLowerCase();
  return WEIGHTED_KEYWORDS.some(k => n.includes(k));
}

function esc(s: string) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildReceiptHTML(bill: Bill, settings: any): string {
  const sym = settings.currencySymbol || '؋';
  const items = bill.items.map((item: BillItem) => `
    <tr>
      <td class="iname">
        <div class="ititle">${esc(item.name)}</div>
        ${item.sku && item.sku !== '—' ? `<div class="isku">${esc(item.sku)}</div>` : ''}
      </td>
      <td class="iqty">${item.qty}</td>
      <td class="irate">${sym}${item.unitPrice.toFixed(0)}</td>
      <td class="iamt">${sym}${item.total.toFixed(0)}</td>
    </tr>
    <tr><td colspan="4"><div class="dotline"></div></td></tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:288px;background:#fff;color:#000;font-family:'Courier New',monospace;font-size:12px;line-height:1.4;overflow:hidden}
.w{width:288px;padding:6px 6px 12px 6px}
.sname{font-size:44px;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:2px;line-height:1.1;margin-bottom:4px}
.stag{font-size:19px;text-align:center;color:#555;margin-bottom:8px}
.scontact{text-align:center;font-size:20px;line-height:1.7}
.sphone{font-weight:bold;font-size:24px}
.thick{border:none;border-top:4px solid #000;margin:10px 0}
.dash{border:none;border-top:2px dashed #666;margin:8px 0}
.dotline{border-top:2px dotted #ccc;margin:4px 0}
.cbox{background:#f5f5f5;border:2px solid #ddd;padding:8px 12px;margin:6px 0;border-radius:4px}
.clabel{font-size:16px;text-transform:uppercase;letter-spacing:2px;color:#777;margin-bottom:2px}
.cname{font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:1px}
.cphone{font-size:24px;font-weight:bold}
table{width:100%;border-collapse:collapse;margin:6px 0}
thead th{font-size:18px;text-transform:uppercase;letter-spacing:1px;font-weight:900;padding:6px 0;border-bottom:3px solid #000;text-align:left}
th.rqty,td.iqty{width:20px;text-align:center}
th.rrate,td.irate{width:50px;text-align:right}
th.ramt,td.iamt{width:52px;text-align:right;font-weight:bold}
td{vertical-align:top;padding:4px 0}
.ititle{font-size:24px;font-weight:bold;line-height:1.2}
.isku{font-size:18px;color:#777}
.iamt{font-size:24px}
.trow{display:flex;justify-content:space-between;font-size:21px;padding:3px 0}
.tlabel{color:#555}.tvalue{font-weight:bold}
.disc{color:#c00}
.grandrow{display:flex;justify-content:space-between;align-items:baseline;border-top:4px solid #000;padding:8px 0 6px;margin-top:4px}
.glabel{font-size:34px;font-weight:900;text-transform:uppercase;letter-spacing:2px}
.gamount{font-size:48px;font-weight:900}
.footer{text-align:center;font-size:21px;line-height:1.7;margin-top:12px}
.fmain{font-size:26px;font-weight:bold}
.fshop{font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-top:6px}
</style></head><body><div class="w">
<div class="sname">${esc(settings.shopName)}</div>
${settings.shopTagline?`<div class="stag">${esc(settings.shopTagline)}</div>`:''}
<hr class="thick">
<div class="scontact">
  ${settings.shopAddress?`<div>${esc(settings.shopAddress)}</div>`:''}
  ${settings.shopCity?`<div>${esc(settings.shopCity)}</div>`:''}
  ${settings.shopPhone?`<div class="sphone">📞 ${esc(settings.shopPhone)}</div>`:''}
  ${settings.shopPhone2?`<div class="sphone">📞 ${esc(settings.shopPhone2)}</div>`:''}
</div>
<hr class="thick">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin:6px 0">
  <div><div style="font-size:16px;color:#777;text-transform:uppercase;letter-spacing:2px">Invoice No.</div>
  <div style="font-size:28px;font-weight:900;letter-spacing:2px">${bill.billNo}</div></div>
  <div style="text-align:right"><div style="font-size:22px;font-weight:bold">${bill.date}</div>
  <div style="font-size:20px;color:#555">${bill.time}</div></div>
</div>
<div class="trow" style="font-size:20px"><span style="color:#666">Served by:</span><span style="font-weight:bold">${esc(bill.createdBy)}</span></div>
<hr class="dash">
<div class="cbox">
  <div class="clabel">Bill To</div>
  <div class="cname">${esc(bill.customerName||'Walk-in Customer')}</div>
  ${bill.customerPhone&&bill.customerPhone!=='—'?`<div class="cphone">📱 ${esc(bill.customerPhone)}</div>`:''}
</div>
<hr class="dash">
<table>
  <thead><tr>
    <th>Item Description</th>
    <th class="rqty" style="text-align:center">Qty</th>
    <th class="rrate" style="text-align:right">Rate</th>
    <th class="ramt" style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>${items}</tbody>
</table>
<div class="trow"><span class="tlabel">Subtotal</span><span class="tvalue">${sym}${bill.subtotal.toFixed(2)}</span></div>
${bill.discount>0?`<div class="trow disc"><span>Discount</span><span>- ${sym}${bill.discount.toFixed(2)}</span></div>`:''}
<div class="grandrow">
  <span class="glabel">Total</span>
  <span class="gamount">${sym}${bill.grandTotal.toFixed(2)}</span>
</div>
${bill.status==='credit' ? `
<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px dashed #ccc;margin-top:4px">
  <span style="font-size:22px;font-weight:900;color:#e65100">PAID</span>
  <span style="font-size:22px;font-weight:900;color:#e65100">${sym}${(bill.amountPaid||0).toFixed(0)}</span>
</div>
<div style="display:flex;justify-content:space-between;padding:2px 0">
  <span style="font-size:22px;font-weight:900;color:#c62828">OWES</span>
  <span style="font-size:22px;font-weight:900;color:#c62828">${sym}${(bill.balance||0).toFixed(0)}</span>
</div>` : ''}
${settings.shopTaxId?`<div style="text-align:center;font-size:19px;color:#666;margin-top:6px">Tax ID: ${esc(settings.shopTaxId)}</div>`:''}
<hr class="dash" style="margin-top:6px">
<div class="footer">
  ${settings.receiptFooter.split('\n').map((l:string,i:number)=>`<div${i===0?' class="fmain"':''}>${esc(l)}</div>`).join('')}
  <div class="fshop">${esc(settings.shopName)}</div>
  ${settings.shopPhone?`<div style="font-size:22px;font-weight:bold">${esc(settings.shopPhone)}</div>`:''}
</div>
</div></body></html>`;
}

export function CheckoutModal({ open, onOpenChange, prefillCustomer }: CheckoutModalProps) {
  const { addBill, getNextBillNo } = useBilling();
  const { tools, deductStock } = useLedger();

  const { user } = useAuth();
  const { settings } = useShopSettings();

  const [step, setStep] = useState<1|2|3>(1);
  const [meterPrompt, setMeterPrompt] = useState<{tool: Tool; suggestedQty: number}|null>(null);
  const [meterQty, setMeterQty] = useState('1');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName,  setCustomerName]  = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount,    setDiscount]    = useState('0');
  const [amountPaid,  setAmountPaid]  = useState('');   // blank = full payment
  const [isCredit,    setIsCredit]    = useState(false); // borrow/on-account
  const [currency, setCurrency] = useState<'Af'|'USD'>(settings.activeCurrency || 'Af');
  const [finishedBill, setFinishedBill] = useState<Bill|null>(null);
  const [printing,  setPrinting]  = useState(false);
  const [printMsg,  setPrintMsg]  = useState<{ok:boolean;text:string}|null>(null);

  // Manual item entry
  const [itemName,  setItemName]  = useState('');
  const [itemSku,   setItemSku]   = useState('');
  const [itemQty,   setItemQty]   = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [itemGrams, setItemGrams] = useState('');
  const [showWeightFor, setShowWeightFor] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<typeof tools>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Inventory picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const itemNameRef = useRef<HTMLInputElement>(null);

  const sym = currency === 'USD' ? '$' : (settings.currencySymbol || '؋');
  const usdRate = settings.usdRate || 70;

  const effectiveSettings = { ...settings, currencySymbol: sym };

  useEffect(() => {
    if (open && prefillCustomer) {
      setCustomerName(prefillCustomer.name);
      setCustomerPhone(prefillCustomer.phone);
    }
  }, [open, prefillCustomer]);

  // Sync currency from settings when opened
  useEffect(() => {
    if (open) setCurrency(settings.activeCurrency || 'Af');
  }, [open, settings.activeCurrency]);

  const subtotal    = cart.reduce((s,i) => s + i.qty * i.unitPrice, 0);
  const discountAmt = parseFloat(discount) || 0;
  const grandTotal  = Math.max(0, subtotal - discountAmt);

  // Convert price: if currency is USD, price entered is in USD, total stays in display currency
  const toDisplayPrice = (afPrice: number) =>
    currency === 'USD' ? afPrice / usdRate : afPrice;

  const pickerItems = useMemo(() => {
    const q = pickerSearch.toLowerCase();
    return tools.filter(t => t.status === 'available' && (
      !q || t.name.toLowerCase().includes(q) || t.sku.toLowerCase().includes(q)
    )).slice(0, 12);
  }, [tools, pickerSearch]);

  const addItemFromInventory = (tool: Tool) => {
    // Set price to minSellPrice as a starting point (editable in cart)
    // If no minSellPrice, default to 0 so user sees empty/zero and types their price
    const rawPrice = tool.maxSellPrice || tool.minSellPrice || 0;
    const price = currency === 'USD' ? rawPrice / usdRate : rawPrice;
    // For metered/weighted items, ask quantity before adding
    const needsQty = tool.unit && tool.unit !== 'piece' && tool.unit !== 'box' && tool.unit !== 'set';
    const cartItemId = `INV-${tool.id}`;
    setCart(prev => {
      const ex = prev.find(c => c.id === cartItemId);
      if (ex) return prev.map(c => c.id===cartItemId ? {...c, qty: c.qty+1} : c);
      return [...prev, {
        id: cartItemId,
        name: tool.name,
        sku: tool.sku,
        qty: 1,
        unitPrice: price,
        unit: tool.unit || 'piece',
        stockRemaining: tool.stock,
        minPrice: tool.minSellPrice ? (currency==='USD' ? tool.minSellPrice/usdRate : tool.minSellPrice) : undefined,
        maxPrice: tool.maxSellPrice ? (currency==='USD' ? tool.maxSellPrice/usdRate : tool.maxSellPrice) : undefined,
      }];
    });
    setShowPicker(false);
    setPickerSearch('');
    setItemName('');
  };

  const confirmMeterAdd = () => {
    if (!meterPrompt) return;
    const qty = parseFloat(meterQty) || 1;
    const { tool } = meterPrompt;
    const rawPrice = tool.maxSellPrice || tool.minSellPrice || 0;
    const price = currency === 'USD' ? rawPrice / usdRate : rawPrice;
    const cartItemId = `INV-${tool.id}`;
    setCart(prev => {
      const ex = prev.find(c => c.id === cartItemId);
      if (ex) return prev.map(c => c.id===cartItemId ? {...c, qty: c.qty+qty} : c);
      return [...prev, {
        id: cartItemId, name: tool.name, sku: tool.sku,
        qty, unitPrice: price, unit: tool.unit || 'piece',
        stockRemaining: tool.stock,
        minPrice: tool.minSellPrice ? (currency==='USD' ? tool.minSellPrice/usdRate : tool.minSellPrice) : undefined,
        maxPrice: tool.maxSellPrice ? (currency==='USD' ? tool.maxSellPrice/usdRate : tool.maxSellPrice) : undefined,
      }];
    });
    setMeterPrompt(null);
    setMeterQty('1');
  };

  // Barcode scanner — wired after all state and functions are defined
  useScanner({
    enabled: open && step === 1,
    onScan: (code) => {
      const tool = tools.find(t =>
        t.sku === code || t.id === code ||
        t.sku.toLowerCase() === code.toLowerCase()
      );
      if (!tool) return;
      const needsQty = tool.unit && !['piece','box','set','pair','dozen','pack'].includes(tool.unit);
      if (needsQty) {
        setMeterPrompt({ tool, suggestedQty: 1 });
        setMeterQty('1');
      } else {
        addItemFromInventory(tool);
      }
    },
  });

  const addManualItem = () => {
    if (!itemName || !itemPrice) return;
    const price = parseFloat(itemPrice);
    const qty   = parseInt(itemQty) || 1;
    const grams = showWeightFor ? parseFloat(itemGrams) || undefined : undefined;
    if (isNaN(price) || price <= 0) return;
    const displayName = grams ? `${itemName} (${grams}g)` : itemName;
    setCart(prev => [...prev, {
      id:`ITEM-${Date.now()}`, name:displayName,
      sku:itemSku.trim()||'—', qty, unitPrice:price, grams
    }]);
    setItemName(''); setItemSku(''); setItemQty('1'); setItemPrice('');
    setItemGrams(''); setShowWeightFor(false);
    itemNameRef.current?.focus();
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));
  const changeQty   = (id: string, d: number) =>
    setCart(prev => prev.map(i => i.id===id ? {...i, qty:Math.max(1,i.qty+d)} : i));
  const changePrice = (id: string, val: string) =>
    setCart(prev => prev.map(i => i.id===id ? {...i, unitPrice:parseFloat(val)||0} : i));

  const handleCheckout = () => {
    const billItems: BillItem[] = cart.map(i => ({
      id:i.id, name:i.name, sku:i.sku, qty:i.qty, unitPrice:i.unitPrice, total:i.qty*i.unitPrice
    }));
    const paid    = isCredit ? (parseFloat(amountPaid) || 0) : grandTotal;
    const balance = Math.max(0, grandTotal - paid);
    const bill = addBill({
      customerName:  customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim() || '—',
      items: billItems, subtotal, discount: discountAmt, grandTotal,
      amountPaid: paid, balance, status: balance > 0 ? 'credit' : 'paid',
      createdBy: user?.name || 'Staff', printed: false,
    });
    // Deduct stock for each sold item that has stock tracking
    cart.forEach(item => {
      // Find the tool by id (INV-{toolId} format) or by name match
      const toolId = item.id.startsWith('INV-') ? item.id.replace('INV-', '') : null;
      if (toolId) {
        const tool = tools.find(t => t.id === toolId);
        if (tool && tool.stock !== undefined) {
          deductStock(toolId, item.qty);
        }
      }
    });
    setFinishedBill(bill);
    setStep(3);
  };

  const handlePrint = async () => {
    if (!finishedBill || printing) return;
    const html = buildReceiptHTML(finishedBill, effectiveSettings);
    setPrinting(true); setPrintMsg(null);
    try {
      // Send structured data (ESC/POS path, no Firefox) + html fallback
      const billData = {
        shopName:       effectiveSettings.shopName,
        shopPhone:      effectiveSettings.shopPhone,
        billNo:         finishedBill.billNo,
        date:           finishedBill.date,
        time:           finishedBill.time,
        createdBy:      finishedBill.createdBy,
        customerName:   finishedBill.customerName,
        customerPhone:  finishedBill.customerPhone,
        items:          finishedBill.items,
        subtotal:       finishedBill.subtotal,
        discount:       finishedBill.discount,
        grandTotal:     finishedBill.grandTotal,
        amountPaid:     finishedBill.amountPaid,
        balance:        finishedBill.balance,
        status:         finishedBill.status,
        currencySymbol: effectiveSettings.currencySymbol || '؋',
        receiptFooter:  effectiveSettings.receiptFooter || 'Thank you!',
      };
      const res = await fetch('/api/print-bill', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({bill:{id:finishedBill.billNo, data:billData, html}}),
      });
      const data = await res.json();
      setPrintMsg({ ok:data.ok, text:data.ok?`✓ ${finishedBill.billNo} sent to printer`:data.message });
    } catch (e:any) {
      setPrintMsg({ok:false, text:`Error: ${e.message}`});
    } finally {
      setPrinting(false);
      setTimeout(() => setPrintMsg(null), 6000);
    }
  };

  const fullReset = () => {
    setStep(1); setCart([]); setCustomerName(''); setCustomerPhone('');
    setIsCredit(false); setAmountPaid('');
    setDiscount('0'); setFinishedBill(null);
    setItemName(''); setItemSku(''); setItemQty('1'); setItemPrice('');
    setItemGrams(''); setShowWeightFor(false); setPrintMsg(null);
    setShowPicker(false); setPickerSearch('');
    setNameSuggestions([]); setShowSuggestions(false);
  };

  const handleClose = (v: boolean) => { onOpenChange(v); if (!v) setTimeout(fullReset, 300); };
  const nextBillNo = getNextBillNo();
  const inp = "bg-background border-border/50 text-foreground placeholder:text-muted-foreground rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/* ── Meter/Weight quantity prompt ── */}
      {meterPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xs shadow-2xl p-6 space-y-4">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Scanned Item</p>
              <p className="font-black text-foreground text-lg">{meterPrompt.tool.name}</p>
              {meterPrompt.tool.stock !== undefined && (
                <p className="text-sm text-yellow-400 mt-1">
                  In stock: {meterPrompt.tool.stock} {meterPrompt.tool.unit}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                How many {meterPrompt.tool.unit}?
              </label>
              <input
                type="number" min="0.1" step="0.5"
                value={meterQty}
                onChange={e => setMeterQty(e.target.value)}
                autoFocus
                className="w-full mt-1 h-14 bg-input border border-border text-foreground text-center text-2xl font-black rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={e => e.key==='Enter' && confirmMeterAdd()}
              />
              <p className="text-xs text-muted-foreground text-center mt-1">
                {meterPrompt.tool.minSellPrice
                  ? `Price: ${currency==='USD'?'$':'؋'}${((meterPrompt.tool.minSellPrice||0) * parseFloat(meterQty||'1')).toFixed(0)}`
                  : 'Enter selling price in cart after adding'}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMeterPrompt(null)}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-black text-sm hover:text-white">
                Cancel
              </button>
              <button onClick={confirmMeterAdd}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-black text-sm hover:brightness-110">
                Add {meterQty} {meterPrompt.tool.unit}
              </button>
            </div>
          </div>
        </div>
      )}

      <DialogContent className="bg-card border-border sm:max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 pb-0 flex-shrink-0">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <ShoppingCart className="h-5 w-5"/>
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-black uppercase tracking-tighter text-white">
                  {step===1?'New Sale':step===2?'Customer & Payment':'Sale Complete'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                  {step===1?`${nextBillNo} · ${cart.length} item${cart.length!==1?'s':''}`:step===2?'Review and confirm':'Bill generated'}
                </DialogDescription>
              </div>
              {/* Currency toggle */}
              <div className="flex gap-1 bg-muted/50 p-0.5 rounded-xl">
                {(['Af','USD'] as const).map(cur => (
                  <button key={cur} onClick={() => setCurrency(cur)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                      currency===cur ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>{cur}</button>
                ))}
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Cart ── */}
            {step===1 && (
              <motion.div key="s1" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-4 mt-4">

                {/* Item entry */}
                <div className="bg-background/40 border border-border/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Add Item</p>
                    <button onClick={() => setShowPicker(p => !p)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                        showPicker ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}>
                      <Package className="w-3.5 h-3.5"/> From Inventory
                    </button>
                  </div>

                  {/* Inventory picker */}
                  {showPicker && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                        <input className={`w-full pl-9 pr-3 py-2 h-10 ${inp}`}
                          placeholder="Search inventory…" value={pickerSearch}
                          onChange={e => setPickerSearch(e.target.value)} autoFocus/>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {pickerItems.map(tool => (
                          <button key={tool.id} onClick={() => addItemFromInventory(tool)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border/30 bg-card/50 hover:bg-primary/5 hover:border-primary/30 transition-all text-left">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{tool.name}</p>
                              <p className="text-xs text-muted-foreground">{tool.sku}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {tool.minSellPrice && tool.maxSellPrice ? (
                                <p className="text-xs text-muted-foreground">
                                  {sym}{currency==='USD'?(tool.minSellPrice/usdRate).toFixed(0):tool.minSellPrice}
                                  {" – "}
                                  {sym}{currency==='USD'?(tool.maxSellPrice/usdRate).toFixed(0):tool.maxSellPrice}
                                </p>
                              ) : tool.minSellPrice ? (
                                <p className="text-xs font-bold text-primary">from {sym}{currency==='USD'?(tool.minSellPrice/usdRate).toFixed(0):tool.minSellPrice}</p>
                              ) : null}
                              {isWeighted(tool.name, tool.sku) && <p className="text-[10px] text-yellow-400">By weight</p>}
                            </div>
                          </button>
                        ))}
                        {pickerSearch && pickerItems.length===0 && <p className="text-center text-xs text-muted-foreground py-4">No items found</p>}
                      </div>
                    </div>
                  )}

                  {/* Manual entry */}
                  {!showPicker && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2 relative">
                        <input
                          ref={itemNameRef}
                          placeholder="Item name — type to search inventory *"
                          value={itemName}
                          autoComplete="off"
                          onChange={e => {
                            const v = e.target.value;
                            setItemName(v);
                            setShowWeightFor(isWeighted(v));
                            // Autocomplete from inventory
                            if (v.length >= 1) {
                              const q = v.toLowerCase();
                              const matches = tools.filter(t =>
                                t.name.toLowerCase().includes(q) ||
                                t.sku.toLowerCase().includes(q)
                              ).slice(0, 6);
                              setNameSuggestions(matches);
                              setShowSuggestions(matches.length > 0);
                            } else {
                              setShowSuggestions(false);
                              setNameSuggestions([]);
                            }
                          }}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                          onFocus={() => {
                            if (itemName.length >= 1 && nameSuggestions.length > 0)
                              setShowSuggestions(true);
                          }}
                          className={`w-full h-10 px-3 ${inp}`}
                          onKeyDown={e => { if (e.key==='Enter') { setShowSuggestions(false); addManualItem(); } }}
                        />
                        {/* Autocomplete dropdown */}
                        {showSuggestions && nameSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                            {nameSuggestions.map(tool => {
                              const dispPrice = tool.minSellPrice
                                ? (currency==='USD' ? tool.minSellPrice/usdRate : tool.minSellPrice)
                                : 0;
                              return (
                                <button
                                  key={tool.id}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => {
                                    // Fill name + sku + suggested price
                                    setItemName(tool.name);
                                    setItemSku(tool.sku);
                                    setItemPrice(dispPrice > 0 ? String(dispPrice) : '');
                                    setShowWeightFor(isWeighted(tool.name, tool.sku));
                                    setShowSuggestions(false);
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/10 transition-colors text-left border-b border-border/30 last:border-0"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{tool.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{tool.sku}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    {tool.minSellPrice && tool.maxSellPrice && (
                                      <p className="text-xs text-primary font-bold">
                                        {sym}{Math.round(currency==='USD'?tool.minSellPrice/usdRate:tool.minSellPrice)}
                                        –{sym}{Math.round(currency==='USD'?tool.maxSellPrice/usdRate:tool.maxSellPrice)}
                                      </p>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <input placeholder="SKU (optional)" value={itemSku} onChange={e=>setItemSku(e.target.value)} className={`h-10 px-3 ${inp}`}/>
                      <input placeholder={`Price (${sym}) *`} type="number" min="0" step="0.01" value={itemPrice}
                        onChange={e=>setItemPrice(e.target.value)} className={`h-10 px-3 ${inp}`}
                        onKeyDown={e=>e.key==='Enter'&&addManualItem()}/>
                      {showWeightFor && (
                        <div className="col-span-2 flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                          <Scale className="w-4 h-4 text-yellow-400 flex-shrink-0"/>
                          <input placeholder="Weight in grams" type="number" min="0" step="0.1" value={itemGrams}
                            onChange={e=>setItemGrams(e.target.value)} className={`flex-1 h-8 px-3 ${inp} bg-transparent border-0 ring-0 focus:ring-0`}/>
                        </div>
                      )}
                      <div className="flex items-center gap-2 col-span-2">
                        <div className="flex items-center gap-2 border border-border/50 rounded-xl px-3 py-2 bg-background">
                          <button onClick={()=>setItemQty(q=>String(Math.max(1,parseInt(q)||1)-1))} className="text-muted-foreground hover:text-white"><Minus className="h-3 w-3"/></button>
                          <input value={itemQty} onChange={e=>setItemQty(e.target.value)} type="number" min="1"
                            className="w-10 bg-transparent border-none p-0 text-center text-sm h-auto focus:outline-none text-foreground"/>
                          <button onClick={()=>setItemQty(q=>String((parseInt(q)||1)+1))} className="text-muted-foreground hover:text-white"><Plus className="h-3 w-3"/></button>
                        </div>
                        <button onClick={addManualItem} disabled={!itemName||!itemPrice}
                          className="flex-1 h-10 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-xs hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2">
                          <Plus className="h-4 w-4"/> Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cart */}
                {cart.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{cart.length} item{cart.length!==1?'s':''} in cart</p>
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{item.sku!=='—'?item.sku:''}</p>
                        </div>
                        <div className="flex items-center gap-1 border border-border/50 rounded-lg px-2 py-1">
                          <button onClick={()=>changeQty(item.id,-1)} className="text-muted-foreground hover:text-white p-0.5"><Minus className="h-3 w-3"/></button>
                          <span className="text-white font-black text-xs w-6 text-center">{item.qty}</span>
                          <button onClick={()=>changeQty(item.id,1)} className="text-muted-foreground hover:text-white p-0.5"><Plus className="h-3 w-3"/></button>
                        </div>
                        <div className="flex flex-col items-end min-w-[88px] gap-0.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{sym}</span>
                            <input
                              type="number" min="0" step="1"
                              value={item.unitPrice === 0 ? "" : item.unitPrice}
                              onChange={e => changePrice(item.id, e.target.value)}
                              placeholder="0"
                              className={`w-24 text-right pl-5 pr-2 py-1.5 rounded-lg text-sm font-black text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:bg-primary/20
                                ${item.unitPrice === 0 ? "bg-red-900/20 border border-red-500/60 placeholder:text-red-400" : "bg-primary/10 border border-primary/40"}`}
                            />
                          </div>
                          {item.minPrice !== undefined && item.maxPrice !== undefined && (
                            <p className="text-[9px] text-muted-foreground text-right">
                              {user?.role !== 'Staff' ? `Range: ` : ''}{sym}{Math.round(item.minPrice)}–{sym}{Math.round(item.maxPrice)}
                            </p>
                          )}
                          {item.stockRemaining !== undefined && (
                            <p className="text-[9px] text-yellow-400 text-right">
                              Stock: {item.stockRemaining} {item.unit||'pcs'}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground text-right">{sym}{(item.qty*(item.unitPrice||0)).toFixed(0)}</p>
                        </div>
                        <button onClick={()=>removeItem(item.id)} className="text-muted-foreground hover:text-red-400 p-1"><Trash2 className="h-4 w-4"/></button>
                      </div>
                    ))}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-muted-foreground font-bold text-sm uppercase tracking-widest">Subtotal</span>
                      <span className="text-white font-black text-lg">{sym}{subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3"/>
                    <p className="text-muted-foreground text-sm uppercase tracking-widest">Cart is empty</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">Add items above or pick from inventory</p>
                  </div>
                )}

                {cart.length>0 && (
                  <button onClick={()=>setStep(2)} className="w-full h-12 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-xs hover:brightness-110 shadow-2xl shadow-primary/20">
                    Continue to Checkout →
                  </button>
                )}
              </motion.div>
            )}

            {/* ── Step 2: Customer & Payment ── */}
            {step===2 && (
              <motion.div key="s2" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-4 mt-4">
                <div className="bg-background/40 border border-border/50 rounded-2xl p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Customer (optional)</p>
                  <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <input placeholder="Customer name" value={customerName} onChange={e=>setCustomerName(e.target.value)} className={`w-full pl-9 pr-3 h-10 ${inp}`}/></div>
                  <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <input placeholder="Phone" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} className={`w-full pl-9 pr-3 h-10 ${inp}`}/></div>
                </div>
                <div className="bg-background/40 border border-border/50 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3">Discount ({sym})</p>
                  <div className="relative"><Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <input placeholder="0.00" type="number" min="0" value={discount} onChange={e=>setDiscount(e.target.value)} className={`w-full pl-9 pr-3 h-10 ${inp}`}/></div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Summary</p>
                  {cart.map(item=>(
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate">{item.name} <span className="text-xs opacity-60">×{item.qty}</span></span>
                      <span className="font-bold text-foreground flex-shrink-0 ml-2">{sym}{(item.qty*item.unitPrice).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border/50 pt-2 space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span></div>
                    {discountAmt>0&&<div className="flex justify-between text-sm text-green-400"><span>Discount</span><span>- {sym}{discountAmt.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-black text-primary text-lg border-t border-border/50 pt-1">
                      <span>Total</span><span>{sym}{grandTotal.toFixed(2)}</span>
                    </div>
                    {currency==='USD' && <p className="text-[10px] text-muted-foreground text-right">≈ ؋{(grandTotal*usdRate).toFixed(0)} (@ {usdRate} Af/$)</p>}
                  </div>
                </div>

                <div className="h-4"/>
              </motion.div>
            )}

        {/* ── Step 2 bottom bar: Credit toggle + action buttons (always visible) ── */}
        {step === 2 && (
          <div className="px-5 pb-5 pt-3 border-t border-border flex-shrink-0 space-y-3">
            {/* Credit / Borrow toggle */}
            <div className="flex items-center justify-between bg-background/40 border border-border rounded-xl px-3 py-2.5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-foreground">On Credit / Borrow (قرض)</p>
                {isCredit && <p className="text-[10px] text-orange-400 mt-0.5">Owes: {sym}{Math.max(0, grandTotal-(parseFloat(amountPaid)||0)).toFixed(0)}</p>}
              </div>
              <div className="flex items-center gap-2">
                {isCredit && (
                  <input type="number" min="0" step="1"
                    value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                    placeholder="Paid now"
                    className="w-24 bg-input border border-orange-500/60 text-foreground rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-500"/>
                )}
                <button type="button" onClick={() => { setIsCredit(v => !v); setAmountPaid(''); }}
                  className={`w-11 h-6 rounded-full transition-all flex-shrink-0 relative ${isCredit ? 'bg-orange-500' : 'bg-muted'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${isCredit ? 'left-[22px]' : 'left-[2px]'}`}/>
                </button>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex gap-3">
              <button onClick={()=>setStep(1)} className="flex-1 h-12 rounded-xl border border-border text-muted-foreground font-black uppercase text-xs hover:text-white flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4"/> Back
              </button>
              <button onClick={handleCheckout} className="flex-[2] h-12 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110 shadow-2xl shadow-primary/20 flex items-center justify-center gap-2">
                    <Receipt className="h-4 w-4"/> Generate Bill
                  </button>
                </div>
          </div>
        )}

            {/* ── Step 3: Done ── */}
            {step===3 && finishedBill && (
              <motion.div key="s3" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="space-y-4 mt-4">
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 border-4 border-green-500/30">
                    <CheckCircle2 className="h-8 w-8"/>
                  </div>
                  <p className="text-white font-black uppercase tracking-tighter text-xl">Sale Recorded</p>
                  <p className="text-primary font-black text-sm uppercase tracking-widest">{finishedBill.billNo}</p>
                </div>
                {/* Receipt preview */}
                <div className="bg-white rounded-2xl overflow-hidden border border-border/20 shadow-xl">
                  <div className="bg-gray-100 px-3 py-1.5 flex items-center gap-1.5 border-b">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-400"/><div className="w-2.5 h-2.5 rounded-full bg-green-400"/>
                    <span className="text-[10px] text-gray-500 ml-2">80mm receipt preview</span>
                  </div>
                  <div className="overflow-y-auto max-h-72 p-3 font-mono text-[10px] text-black">
                    <div className="font-black text-[17px] uppercase text-center leading-tight">{settings.shopName}</div>
                    {settings.shopTagline&&<div className="text-center text-[9px] text-gray-500 mb-1">{settings.shopTagline}</div>}
                    <div className="border-t-2 border-black my-1.5"/>
                    <div className="text-center text-[9.5px] leading-relaxed">
                      {settings.shopAddress&&<div>{settings.shopAddress}</div>}
                      {settings.shopCity&&<div>{settings.shopCity}</div>}
                      {settings.shopPhone&&<div className="font-bold text-[11px]">📞 {settings.shopPhone}</div>}
                    </div>
                    <div className="border-t-2 border-black my-1.5"/>
                    <div className="flex justify-between mb-1">
                      <div><div className="text-[7px] text-gray-500 uppercase">Invoice No.</div><div className="font-black text-[13px]">{finishedBill.billNo}</div></div>
                      <div className="text-right"><div className="font-bold text-[10px]">{finishedBill.date}</div><div className="text-gray-500 text-[9px]">{finishedBill.time}</div></div>
                    </div>
                    <div className="border-t border-dashed border-gray-400 my-1.5"/>
                    <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5 mb-1.5">
                      <div className="text-[7px] text-gray-500 uppercase">Bill To</div>
                      <div className="font-black text-[12px] uppercase">{finishedBill.customerName}</div>
                      {finishedBill.customerPhone!=='—'&&<div className="font-bold text-[10px]">📱 {finishedBill.customerPhone}</div>}
                    </div>
                    <div className="border-t border-dashed border-gray-400 my-1.5"/>
                    <div className="flex text-[8px] uppercase font-black border-b border-black pb-0.5 mb-1">
                      <span className="flex-1">Item</span><span className="w-5 text-center">Qty</span><span className="w-12 text-right">Rate</span><span className="w-12 text-right">Total</span>
                    </div>
                    {finishedBill.items.map((item,i)=>(
                      <div key={i} className="mb-1.5">
                        <div className="font-bold text-[11px]">{item.name}</div>
                        {item.sku&&item.sku!=='—'&&<div className="text-[8px] text-gray-500">{item.sku}</div>}
                        <div className="flex text-[9.5px]">
                          <span className="flex-1"/>
                          <span className="w-5 text-center">{item.qty}</span>
                          <span className="w-12 text-right">{sym}{item.unitPrice.toFixed(2)}</span>
                          <span className="w-12 text-right font-bold">{sym}{item.total.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-dotted border-gray-300 mt-1"/>
                      </div>
                    ))}
                    <div className="flex justify-between text-[9.5px] mt-1"><span className="text-gray-500">Subtotal</span><span className="font-bold">{sym}{finishedBill.subtotal.toFixed(2)}</span></div>
                    {finishedBill.discount>0&&<div className="flex justify-between text-[9.5px] text-red-600"><span>Discount</span><span>- {sym}{finishedBill.discount.toFixed(2)}</span></div>}
                    <div className="flex justify-between border-t-2 border-black mt-1 pt-1">
                      <span className="font-black text-[13px] uppercase">Total</span>
                      <span className="font-black text-[18px]">{sym}{finishedBill.grandTotal.toFixed(2)}</span>
                    </div>
                    {currency==='USD'&&<div className="text-right text-[9px] text-gray-500">≈ ؋{(finishedBill.grandTotal*usdRate).toFixed(0)}</div>}
                    <div className="border-t border-dashed border-gray-400 mt-2 pt-2 text-center text-[9.5px] leading-relaxed">
                      {settings.receiptFooter.split('\n').map((l:string,i:number)=><div key={i} className={i===0?'font-bold text-[11px]':''}>{l}</div>)}
                      <div className="font-black text-[10px] uppercase tracking-widest mt-1">{settings.shopName}</div>
                    </div>
                  </div>
                </div>
                {printMsg&&<p className={`text-xs font-bold px-3 py-1.5 rounded-xl border text-center ${printMsg.ok?'text-green-400 bg-green-900/20 border-green-700/30':'text-red-400 bg-red-900/20 border-red-700/30'}`}>{printMsg.text}</p>}
                <div className="flex gap-3">
                  <button onClick={handlePrint} disabled={printing}
                    className="flex-1 h-12 rounded-xl border border-border font-black uppercase text-xs hover:border-primary/50 hover:text-primary disabled:opacity-50 flex items-center justify-center gap-2">
                    <Printer className="h-4 w-4"/>{printing?'Printing…':'Print Bill'}
                  </button>
                  <button onClick={()=>handleClose(false)} className="flex-1 h-12 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110">Done</button>
                </div>
                <button onClick={fullReset} className="w-full text-muted-foreground text-xs uppercase tracking-widest font-black hover:text-white">New Sale</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
