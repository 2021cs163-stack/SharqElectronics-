import { appStorage, flushCloudData } from '@/lib/app-storage';
import { supabaseConfigured } from '@/lib/supabase';
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useLedger, Tool } from "@/hooks/use-ledger";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { useAuth } from "@/hooks/use-auth";
import { useActivityLog } from "@/hooks/use-activity-log";
import { ScanToolModal } from "@/components/modals/ScanToolModal";
import { AddToolModal }  from "@/components/modals/AddToolModal";
import {
  Search, Plus, QrCode, Download, X, Wrench,
  Edit3, Trash2, Upload, AlertTriangle, Check,
  RefreshCw, Package
} from "lucide-react";

const STATUSES = ["all","available","checked-out","repair","assigned-loss","disposed"];
const statusLabel: Record<string,string> = {
  available:"Available","checked-out":"Checked Out",repair:"In Repair",
  "assigned-loss":"Assigned Loss",disposed:"Disposed",
};
const statusStyle: Record<string,string> = {
  available:      "bg-green-900/40 text-green-400 border border-green-700/40",
  "checked-out":  "bg-blue-900/40 text-blue-400 border border-blue-700/40",
  repair:         "bg-orange-900/40 text-orange-400 border border-orange-700/40",
  "assigned-loss":"bg-red-900/40 text-red-400 border border-red-700/40",
  disposed:       "bg-muted text-muted-foreground border border-border",
};

function parseCSV(text: string): Partial<Tool>[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g,''));
  const idx = (keys: string[]) => keys.map(k => headers.findIndex(h => h.includes(k))).find(i => i >= 0) ?? -1;
  const iName = idx(['name','tool','item','product']);
  const iSku  = idx(['sku','tag','barcode','id','code']);
  const iCost = idx(['cost','costprice','purchase']);
  const iMin  = idx(['min','minsell','minimum']);
  const iMax  = idx(['max','maxsell','maximum']);
  const iCat  = idx(['cat','category','type']);
  const iLoc  = idx(['loc','location','store']);
  const iNote  = idx(['note','notes','desc']);
  const iStock = idx(['stock','quantity','qty','remaining','in stock']);
  const iThresh= idx(['threshold','alert','low','lowstock','minimum']);
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g,''));
    const t: Partial<Tool> = {};
    if (iName >= 0 && cols[iName]) t.name = cols[iName];
    if (iSku  >= 0 && cols[iSku])  t.sku  = cols[iSku];
    if (iCost >= 0 && cols[iCost]) t.costPrice = parseFloat(cols[iCost]) || 0;
    if (iMin  >= 0 && cols[iMin])  t.minSellPrice = parseFloat(cols[iMin]) || undefined;
    if (iMax  >= 0 && cols[iMax])  t.maxSellPrice = parseFloat(cols[iMax]) || undefined;
    if (iCat  >= 0 && cols[iCat])  t.category = cols[iCat];
    if (iLoc  >= 0 && cols[iLoc])  t.location = cols[iLoc];
    if (iNote  >= 0 && cols[iNote])  t.notes = cols[iNote];
    if (iStock >= 0 && cols[iStock]) t.stock = parseFloat(cols[iStock]) || undefined;
    return t;
  }).filter(t => t.name);
}

export default function Inventory() {
  const { tools, addTool, updateTool, deleteTool, logRepair, completeRepair, resetAllData } = useLedger();
  const { log: actLog } = useActivityLog();
  const { settings } = useShopSettings();
  const { user } = useAuth();
  const sym = settings.currencySymbol || "؋";
  const isPartner  = user?.role === "Partner";
  const isTech     = user?.role === "Tech";
  const isStaff    = user?.role === "Staff";
  const canEdit    = isTech || isPartner; // Tech and Partner can edit inventory
  const canSeeFinancials = !isStaff;  // Staff cannot see cost prices

  const [search,  setSearch]  = useState("");
  const [cat,     setCat]     = useState("All");
  const [status,  setStatus]  = useState("all");
  const [modal,   setModal]   = useState<"scan"|"add"|null>(null);
  const [detail,  setDetail]  = useState<Tool|null>(null);
  const [quickStock, setQuickStock] = useState<{id:string; val:string}|null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm,setEditForm]= useState<Partial<Tool>>({});
  const [repairNote,setRepairNote] = useState("");
  const [actionMsg, setActionMsg]  = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editReason,    setEditReason]    = useState("");
  const [deleteReason,  setDeleteReason]  = useState("");
  const [confirmReset,  setConfirmReset]  = useState(false);

  // CSV import state
  const [csvModal,    setCsvModal]    = useState(false);
  const [csvPreview,  setCsvPreview]  = useState<Partial<Tool>[]>([]);
  const [csvError,    setCsvError]    = useState("");
  const [csvImported, setCsvImported] = useState(false);

  const allCats = ["All", ...new Set(tools.map(t => t.category))].sort();

  const filtered = useMemo(() => tools.filter(t => {
    const q = search.toLowerCase();
    return (
      (!q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.sku.toLowerCase().includes(q))
      && (cat === "All" || t.category === cat)
      && (status === "all" || t.status === status)
    );
  }), [tools, search, cat, status]);

  // Are these the old demo tools from the template?
  const hasOldDemoTools = tools.some(t => t.sku === "DW-DRILL-001" || t.sku === "MIL-IMP-02" || t.sku === "MAK-SAW-01");

  const exportCSV = () => {
    const rows = [
      ["ID","Name","SKU","Category","Location","Status","Cost","Min Sell","Max Sell","Notes"],
      ...filtered.map(t => [t.id,t.name,t.sku,t.category,t.location,t.status,t.costPrice,t.minSellPrice??'',t.maxSellPrice??'',t.notes??''])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="inventory.csv"; a.click();
  };

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target?.result as string);
        if (parsed.length === 0) { setCsvError("No valid rows found. Check column headers."); return; }
        setCsvPreview(parsed); setCsvError("");
      } catch { setCsvError("Could not parse file."); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmCSVImport = () => {
    if (!user) return;
    csvPreview.forEach(t => addTool(t, user));
    setCsvImported(true); setCsvPreview([]);
    setTimeout(() => { setCsvModal(false); setCsvImported(false); }, 1500);
  };

  const loadShopInventory = () => {
    // Wipe tools from localStorage then reload — SEED_TOOLS will load
    appStorage.removeItem('shopshield_tools');
    appStorage.removeItem('shopshield_ledger');
    appStorage.removeItem('shopshield_day_state');
    void flushCloudData().then(() => window.location.reload()).catch(() => {});
  };

  const openDetail = (tool: Tool) => {
    setDetail(tool); setEditing(false); setEditForm({});
    setRepairNote(""); setActionMsg(""); setConfirmDelete(false);
  };

  const startEdit = () => { if (!detail) return; setEditForm({...detail}); setEditing(true); };

  const saveEdit = () => {
    if (!detail) return;
    actLog({
      userId: user?.id||'', userName: user?.name||'?', userRole: user?.role||'',
      type: 'edit', target: `Tool: ${detail.name} (${detail.id})`,
      action: `Edited: ${Object.keys(editForm).join(', ')}`,
      reason: editReason || '(no reason given)',
      before: JSON.stringify({name:detail.name, costPrice:detail.costPrice}),
      after:  JSON.stringify(editForm),
    });
    updateTool(detail.id, editForm, user ?? undefined);
    setDetail({...detail,...editForm});
    setEditing(false); setEditReason('');
    setActionMsg(`Saved by ${user?.name} ✓`);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const doRepair = () => {
    if (!detail || !user) return;
    logRepair(detail.id, repairNote, user);
    setActionMsg("Logged for repair ✓");
    setTimeout(() => { setDetail(null); setActionMsg(""); setRepairNote(""); }, 1800);
  };

  const doCompleteRepair = () => {
    if (!detail || !user) return;
    completeRepair(detail.id, user);
    setActionMsg("Repair complete ✓");
    setTimeout(() => { setDetail(null); setActionMsg(""); }, 1800);
  };

  const doDelete = () => {
    if (!detail) return;
    actLog({
      userId: user?.id||'', userName: user?.name||'?', userRole: user?.role||'',
      type: 'delete', target: `Tool: ${detail.name} (${detail.id})`,
      action: `Deleted tool`,
      reason: deleteReason || '(no reason given)',
      before: JSON.stringify({name:detail.name, status:detail.status}),
    });
    deleteTool(detail.id, user ?? undefined);
    setDetail(null); setConfirmDelete(false); setDeleteReason('');
  };

  const inp = "w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Layout>
      <ScanToolModal open={modal==="scan"} onOpenChange={v=>setModal(v?"scan":null)}/>
      <AddToolModal  open={modal==="add"}  onOpenChange={v=>setModal(v?"add":null)}/>

      {/* ── Load real inventory banner ── */}
      {hasOldDemoTools && (
        <div className="mb-4 flex items-center gap-4 p-4 rounded-2xl bg-yellow-900/20 border border-yellow-700/30">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0"/>
          <div className="flex-1">
            <p className="text-yellow-400 font-black text-sm">Demo data detected</p>
            <p className="text-xs text-muted-foreground">These are template tools. Load your real shop inventory instead.</p>
          </div>
          {isPartner && (
            <button onClick={() => setConfirmReset(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-600 text-white font-black uppercase text-xs hover:bg-yellow-500 flex-shrink-0">
              <RefreshCw className="w-3.5 h-3.5"/> Load Shop Inventory
            </button>
          )}
        </div>
      )}

      {/* ── Confirm load real inventory ── */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-yellow-700/40 rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
            <RefreshCw className="w-10 h-10 text-yellow-400 mx-auto"/>
            <p className="font-black text-foreground text-lg">Load Real Inventory?</p>
            <p className="text-sm text-muted-foreground">This will replace all current tools and ledger with your 69 real shop products (Sharq Electronics inventory). Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground font-black text-xs hover:text-white">Cancel</button>
              <button onClick={loadShopInventory} className="flex-1 py-2.5 rounded-xl bg-yellow-600 text-white font-black text-xs hover:brightness-110">Load Now</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail / Edit modal ── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-black uppercase tracking-tighter text-foreground text-base">
                  {editing ? "Edit Tool" : detail.name}
                </h3>
                <p className="text-xs text-muted-foreground">{detail.id} · {detail.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                {!editing && canEdit && (
                  <button onClick={startEdit} title="Edit" className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    <Edit3 className="w-4 h-4"/>
                  </button>
                )}
                <button onClick={() => { setDetail(null); setEditing(false); setConfirmDelete(false); }} className="p-2 text-muted-foreground hover:text-white">
                  <X className="w-5 h-5"/>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {actionMsg && <p className="text-center text-green-400 font-black text-sm py-2">{actionMsg}</p>}

              {!editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Category",  detail.category],
                      ["Location",  detail.location],
                      ["Status",    statusLabel[detail.status] ?? detail.status],
                      ["Added",     detail.dateAdded],
                      ["Cost",      `${sym}${detail.costPrice}`],
                      ["Min Sell",  detail.minSellPrice ? `${sym}${detail.minSellPrice}` : "—"],
                      ["Max Sell",  detail.maxSellPrice ? `${sym}${detail.maxSellPrice}` : "—"],
                      ...(canSeeFinancials ? [["Cost Price", `${sym}${detail.costPrice || 0}`]] : []),
                      ["Unit",      detail.unit || "piece"],
                      ["In Stock",  detail.stock !== undefined ? `${detail.stock} ${detail.unit||"pcs"}` : "Not tracked"],
                      ["Cal. Due",  detail.calibrationDue || "—"],
                    ].map(([k,v]) => (
                      <div key={String(k)}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k}</p>
                        <p className="font-bold text-foreground text-sm">{v}</p>
                      </div>
                    ))}
                  </div>
                  {detail.notes && <p className="text-sm text-muted-foreground">{detail.notes}</p>}

                  {detail.status === "available" && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Log Repair</p>
                      <input className={inp} placeholder="Repair notes…" value={repairNote} onChange={e=>setRepairNote(e.target.value)}/>
                      <button onClick={doRepair} disabled={!repairNote}
                        className="w-full py-2.5 rounded-xl border border-orange-700/40 text-orange-400 text-xs font-black uppercase hover:bg-orange-900/20 disabled:opacity-40">
                        Log for Repair
                      </button>
                    </div>
                  )}
                  {detail.status === "repair" && (
                    <button onClick={doCompleteRepair}
                      className="w-full py-2.5 rounded-xl bg-green-700 text-white text-xs font-black uppercase">
                      Mark Repair Complete
                    </button>
                  )}

                  {/* Delete confirmation inline */}
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)}
                      className="w-full py-2 rounded-xl border border-red-900/40 text-red-400 text-xs font-black uppercase hover:bg-red-900/20 flex items-center justify-center gap-2">
                      <Trash2 className="w-3.5 h-3.5"/> Delete Tool
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-red-900/20 border border-red-700/30 space-y-2">
                      <p className="text-sm text-red-400 font-black text-center">Delete "{detail.name}"?</p>
                      <p className="text-xs text-muted-foreground text-center">Logged as deleted by {user?.name}</p>
                      <input className={`${inp} text-xs`} placeholder="Reason for deletion *" value={deleteReason} onChange={e=>setDeleteReason(e.target.value)}/>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-xl border border-border text-muted-foreground text-xs font-black hover:text-white">Cancel</button>
                        <button onClick={doDelete} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-black hover:brightness-110">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="label-stencil">Name</label><input className={`${inp} mt-1`} value={editForm.name||""} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}/></div>
                  <div><label className="label-stencil">SKU / Tag ID</label><input className={`${inp} mt-1`} value={editForm.sku||""} onChange={e=>setEditForm(f=>({...f,sku:e.target.value}))}/></div>
                  <div><label className="label-stencil">Category</label><input className={`${inp} mt-1`} value={editForm.category||""} onChange={e=>setEditForm(f=>({...f,category:e.target.value}))}/></div>
                  <div><label className="label-stencil">Location</label><input className={`${inp} mt-1`} value={editForm.location||""} onChange={e=>setEditForm(f=>({...f,location:e.target.value}))}/></div>
                  <div><label className="label-stencil">Cost ({sym})</label><input type="number" className={`${inp} mt-1`} value={editForm.costPrice??""} onChange={e=>setEditForm(f=>({...f,costPrice:parseFloat(e.target.value)||0}))}/></div>
                  <div><label className="label-stencil">Min Sell ({sym})</label><input type="number" className={`${inp} mt-1`} value={editForm.minSellPrice??""} onChange={e=>setEditForm(f=>({...f,minSellPrice:parseFloat(e.target.value)||undefined}))}/></div>
                  <div><label className="label-stencil">Max Sell ({sym})</label><input type="number" className={`${inp} mt-1`} value={editForm.maxSellPrice??""} onChange={e=>setEditForm(f=>({...f,maxSellPrice:parseFloat(e.target.value)||undefined}))}/></div>
                  <div><label className="label-stencil">Calibration Due</label><input type="date" className={`${inp} mt-1`} value={editForm.calibrationDue||""} onChange={e=>setEditForm(f=>({...f,calibrationDue:e.target.value}))}/></div>
                  <div>
                    <label className="label-stencil">Unit of Measure</label>
                    <select className={`${inp} mt-1`} value={editForm.unit||'piece'} onChange={e=>setEditForm(f=>({...f,unit:e.target.value}))}>
                      <option value="piece">Piece / Each</option>
                      <option value="meter">Meter (m)</option>
                      <option value="foot">Foot (ft)</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="gram">Gram (g)</option>
                      <option value="liter">Liter (L)</option>
                      <option value="box">Box</option>
                      <option value="roll">Roll</option>
                      <option value="set">Set</option>
                      <option value="pair">Pair</option>
                      <option value="dozen">Dozen</option>
                      <option value="pack">Pack</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-stencil">Stock / Quantity in Store</label>
                    <input type="number" min="0" step="0.1" className={`${inp} mt-1`}
                      placeholder={`How many ${editForm.unit||'pieces'} in stock`}
                      value={editForm.stock ?? ''} onChange={e=>setEditForm(f=>({...f,stock:parseFloat(e.target.value)||undefined}))}/>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {editForm.unit && editForm.unit !== 'piece' ? `For wire/cable/etc: enter total meters/kg available` : 'Leave blank if not tracked'}
                    </p>
                  </div>
                  <div>
                    <label className="label-stencil">Low Stock Alert At</label>
                    <input type="number" min="0" step="0.1" className={`${inp} mt-1`}
                      placeholder="e.g. 5 (alert when ≤5 left)"
                      value={editForm.lowStockThreshold ?? ''} onChange={e=>setEditForm(f=>({...f,lowStockThreshold:parseFloat(e.target.value)||undefined}))}/>
                  </div>
                  <div className="col-span-2"><label className="label-stencil">Notes</label><input className={`${inp} mt-1`} value={editForm.notes||""} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}/></div>
                  <div className="col-span-2 space-y-1">
                    <label className="label-stencil">Reason for edit *</label>
                    <input className={`${inp} mt-1`} placeholder="Why are you editing this?" value={editReason} onChange={e=>setEditReason(e.target.value)}/>
                    <p className="text-[10px] text-muted-foreground">Logged as: <span className="text-foreground font-bold">{user?.name} ({user?.role})</span></p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border flex gap-2 flex-shrink-0">
              {!editing ? (
                <button onClick={() => setDetail(null)}
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase text-xs">Close</button>
              ) : (
                <>
                  <button onClick={() => setEditing(false)}
                    className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-black uppercase text-xs hover:text-white">Cancel</button>
                  <button onClick={saveEdit}
                    className="flex-[2] py-3 rounded-xl bg-primary text-white font-black uppercase text-xs flex items-center justify-center gap-2">
                    <Check className="w-4 h-4"/> Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Import Modal ── */}
      {csvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h3 className="font-black uppercase tracking-tighter text-white">Import from CSV</h3>
              <button onClick={()=>{ setCsvModal(false); setCsvPreview([]); setCsvError(""); }} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {csvImported ? (
                <div className="text-center py-8"><Check className="w-12 h-12 text-green-400 mx-auto mb-3"/><p className="font-black text-green-400">Imported successfully!</p></div>
              ) : (
                <>
                  <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
                    <p className="font-bold text-foreground">CSV column headers (any order):</p>
                    <p><code className="text-primary">name</code> · <code className="text-primary">sku</code> · <code className="text-primary">costPrice</code> · <code className="text-primary">minSellPrice</code> · <code className="text-primary">maxSellPrice</code> · <code className="text-primary">category</code> · <code className="text-primary">location</code></p>
                  </div>
                  <label className="flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-all">
                    <Upload className="w-6 h-6 text-primary"/>
                    <div className="text-center"><p className="font-black text-foreground">Click to upload CSV</p><p className="text-xs text-muted-foreground mt-0.5">.csv files only</p></div>
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSVFile}/>
                  </label>
                  {csvError && <p className="text-red-400 text-xs font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4"/>{csvError}</p>}
                  {csvPreview.length > 0 && (
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{csvPreview.length} items ready to import</p>
                      <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl overflow-hidden">
                        {csvPreview.slice(0,20).map((t,i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{t.name}</p>
                              <p className="text-xs text-muted-foreground">{t.sku || "no sku"} · {t.category || "no cat"}</p>
                            </div>
                            {t.costPrice !== undefined && <span className="text-xs text-muted-foreground">{sym}{t.costPrice}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {!csvImported && csvPreview.length > 0 && (
              <div className="p-5 border-t border-border flex-shrink-0">
                <button onClick={confirmCSVImport} className="w-full py-3 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110">Import {csvPreview.length} Items</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main page ── */}
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Inventory</h1>
            <p className="text-muted-foreground text-sm mt-1">{filtered.length} of {tools.length} items</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>setCsvModal(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border text-muted-foreground font-black uppercase text-xs hover:text-foreground hover:border-primary/40 transition-all">
              <Upload className="w-4 h-4"/> CSV
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border text-muted-foreground font-black uppercase text-xs hover:text-foreground hover:border-primary/40 transition-all">
              <Download className="w-4 h-4"/> Export
            </button>
            <button onClick={()=>setModal("scan")}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border text-muted-foreground font-black uppercase text-xs hover:border-primary/50 hover:text-primary transition-all">
              <QrCode className="w-4 h-4"/> Scan
            </button>
            <button onClick={()=>setModal("add")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-black uppercase text-xs shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
              <Plus className="w-4 h-4"/> Add
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input className="w-full bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search name, SKU, ID…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select value={cat} onChange={e=>setCat(e.target.value)}
            className="bg-card border border-border text-foreground rounded-xl px-3 py-2.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary">
            {allCats.map(c=><option key={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e=>setStatus(e.target.value)}
            className="bg-card border border-border text-foreground rounded-xl px-3 py-2.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary">
            {STATUSES.map(s=><option key={s} value={s}>{s==="all"?"All Status":statusLabel[s]||s}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Category</th>
                  {canSeeFinancials && <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cost</th>}
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Unit</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Stock</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Stock</th>
                  {canSeeFinancials && <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Min–Max</th>}
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                    {tools.length === 0 ? "No tools yet — add your first item or load shop inventory" : "No tools match filters"}
                  </td></tr>
                )}
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-primary/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-bold text-foreground text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.id}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><span className="font-mono text-xs text-muted-foreground">{t.sku}</span></td>
                    <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs text-muted-foreground">{t.category}</span></td>
                    {canSeeFinancials && <td className="px-4 py-3 text-right"><span className="text-sm font-bold text-foreground">{sym}{t.costPrice}</span></td>}
                    <td className="px-4 py-3 hidden md:table-cell"><span className="text-[10px] text-muted-foreground uppercase">{t.unit||'piece'}</span></td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {quickStock?.id === t.id ? (
                        <input
                          type="number" min="0" step="0.1" autoFocus
                          value={quickStock.val}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setQuickStock({id:t.id, val:e.target.value})}
                          onBlur={() => {
                            const n = parseFloat(quickStock.val);
                            if (!isNaN(n)) updateTool(t.id, {...t, stock: n});
                            setQuickStock(null);
                          }}
                          onKeyDown={e => {
                            if (e.key==='Enter') { e.currentTarget.blur(); }
                            if (e.key==='Escape') setQuickStock(null);
                          }}
                          className="w-20 text-center bg-input border border-primary rounded-lg px-2 py-1 text-sm font-black text-primary focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setQuickStock({id:t.id, val:String(t.stock ?? '')}); }}
                          className="text-sm font-black text-foreground hover:text-primary transition-colors tabular-nums"
                          title="Click to edit stock">
                          {t.stock !== undefined ? t.stock : <span className="text-muted-foreground/40">—</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      {t.stock !== undefined ? (
                        <span className={`text-xs font-black ${
                          t.lowStockThreshold !== undefined && t.stock <= t.lowStockThreshold
                            ? 'text-red-400' : 'text-foreground'
                        }`}>{t.stock} {t.unit||'pcs'}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {canSeeFinancials && <td className="px-4 py-3 text-right hidden lg:table-cell">
                      {t.minSellPrice && t.maxSellPrice
                        ? <span className="text-xs text-muted-foreground">{sym}{t.minSellPrice}–{sym}{t.maxSellPrice}</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </td>}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${statusStyle[t.status]??''}`}>
                        {statusLabel[t.status]??t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {canEdit && <button onClick={() => { openDetail(t); startEdit(); setDetail(t); setEditForm({...t}); setEditing(true); }}
                          title="Edit" className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          <Edit3 className="w-3.5 h-3.5"/>
                        </button>}
                        <button onClick={() => openDetail(t)}
                          title="View / Delete" className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-white transition-colors">
                          <Package className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
