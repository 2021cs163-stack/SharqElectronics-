import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useLedger, Tool } from "@/hooks/use-ledger";
import { useAuth } from "@/hooks/use-auth";
import { Printer, CheckSquare, Square, Search, Tag, AlertTriangle, Edit3, X } from "lucide-react";

// 38×28mm label @ 96 DPI screen resolution
// Python script renders at this size, scales to 304×224px (203 DPI)
const SCREEN_W = 480;
const SCREEN_H = 424;

const STATUS_COLOR: Record<string, string> = {
  "available":     "#2e7d32",
  "checked-out":   "#1565c0",
  "repair":        "#e65100",
  "assigned-loss": "#c62828",
};

function esc(s: string) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Build one complete HTML document per tag.
// JsBarcode runs synchronously via the inlined script, so the
// barcode is fully rendered before the browser screenshots it.
function buildTagHTML(tool: Tool, jsSrc: string): string {
  const dot = STATUS_COLOR[tool.status] ?? "#888";
  const rawPrice = (tool as any).maxSellPrice !== undefined ? (tool as any).maxSellPrice
              : (tool as any).minSellPrice !== undefined  ? (tool as any).minSellPrice
              : (tool as any).costPrice    !== undefined  ? (tool as any).costPrice
              : "";
  const price = rawPrice;
  const priceStr = price ? `AF ${price}` : "";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{
  width:${SCREEN_W}px;
  height:${SCREEN_H}px;
  background:#fff;
  font-family:'Courier New',Courier,monospace;
  overflow:hidden;
}
.tag{
  width:${SCREEN_W}px;
  height:${SCREEN_H}px;
  padding:3px 2px;
  background:#fff;
  display:flex;
  flex-direction:column;
}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:1px}
.brand{font-size:26px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#111}
.dot{width:14px;height:14px;border-radius:50%;flex-shrink:0}
.bc{display:block;width:100%;flex:1;min-height:0}
.name{font-size:28px;color:#111;text-align:center;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;margin-top:4px;font-weight:bold}
.price{font-size:32px;font-weight:900;color:#111;text-align:center;margin-top:2px}
.foot{display:flex;justify-content:space-between;font-size:22px;color:#444;
  margin-top:2px;border-top:1px dashed #bbb;padding-top:2px}
.phone{font-size:20px;color:#444}
</style>
</head>
<body>
<div class="tag">
  <div class="hdr">
    <center><span class="brand">Sharq Electronics</span><br /><span class="phone">0787636461</span></center>
    <span class="dot" style="background:${dot}"></span>
  </div>
  <svg id="bc"></svg>
  <div class="name">${esc(tool.name)}</div>
  ${priceStr ? `<div class="price">${priceStr}</div>` : ""}
  <div class="foot">
    <span>${esc(tool.sku)}</span>
  </div>
</div>
<script>
${jsSrc}
// Run JsBarcode synchronously — barcode is drawn before page is visible
JsBarcode(document.getElementById("bc"), "${esc(tool.id)}", {
  format:       "CODE128",
  width:        2,
  height:       100,
  displayValue: true,
  fontSize:     22,
  margin:       4,
  background:   "#ffffff",
  lineColor:    "#000000",
  textMargin:   2,
});
// Resize SVG to fill available space
var svg = document.getElementById("bc");
svg.style.width  = "100%";
svg.style.height = "50%";
svg.style.display = "block";
<\/script>
</body>
</html>`;
}

// ── Preview tag (on-screen only) ──────────────────────────────────────────────
function PreviewTag({ tool }: { tool: Tool }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dot = STATUS_COLOR[tool.status] ?? "#888";

  useEffect(() => {
    if (!svgRef.current) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      try {
        JsBarcode(svgRef.current!, tool.id, {
          format: "CODE128", width: 2, height: 38,
          displayValue: true, fontSize: 7, margin: 1,
          background: "#ffffff", lineColor: "#000000", textMargin: 1,
        });
      } catch (e) { console.error(e); }
    });
  }, [tool.id]);

  return (
    <div style={{
      width: SCREEN_W / 4, height: SCREEN_H / 4, background: "white",
      border: "1px solid #e5e7eb", borderRadius: 4,
      padding: "3px 4px", fontFamily: "monospace",
      boxSizing: "border-box", overflow: "hidden", flexShrink: 0,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:1 }}>
        <span style={{ fontSize:10, fontWeight:"bold", letterSpacing:.5, textTransform:"uppercase", color:"#111" }}>ShopShield V1</span>
        <span style={{ width:4, height:2, borderRadius:"50%", background:dot, display:"inline-block" }}/>
      </div>
      <svg ref={svgRef} style={{ width:"100%", height:"50%", display:"block" }}/>
      <div style={{ fontSize:5.5, color:"#333", textAlign:"center", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", marginTop:1 }}>{tool.name}</div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:5, color:"#666", marginTop:1, borderTop:"0.5px dashed #ccc", paddingTop:1 }}>
        <span>{tool.sku}</span><span>{tool.category}</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PrintTags() {
  const { tools, updateTool } = useLedger();
  const { user } = useAuth();
  const isTech = user?.role === 'Tech';
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copies,   setCopies]   = useState(1);
  const [printing, setPrinting] = useState(false);
  const [printMsg,  setPrintMsg]  = useState<{ ok: boolean; text: string } | null>(null);
  const [editTool,  setEditTool]  = useState<Tool|null>(null);
  const [editName,  setEditName]  = useState('');
  const [editSku,   setEditSku]   = useState('');
  const [editCat,   setEditCat]   = useState('');

  const filtered = tools.filter(t => {
    if (t.status === "disposed") return false;
    const q = search.toLowerCase();
    return !q || t.name.toLowerCase().includes(q)
              || t.id.toLowerCase().includes(q)
              || t.sku.toLowerCase().includes(q);
  });

  const toggle = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll   = () => setSelected(new Set(filtered.map(t => t.id)));
  const deselectAll = () => setSelected(new Set());
  const tagsToPrint = tools.filter(t => selected.has(t.id));

  const handlePrint = async () => {
    if (tagsToPrint.length === 0 || printing) return;

    // Load JsBarcode source to inline into each tag's HTML
    let jsSrc = "";
    for (const url of [
      "/node_modules/jsbarcode/dist/JsBarcode.all.min.js",
      "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js",
    ]) {
      try {
        const r = await fetch(url);
        if (r.ok) { jsSrc = await r.text(); break; }
      } catch (_) {}
    }
    if (!jsSrc) {
      setPrintMsg({ ok: false, text: "Could not load JsBarcode. Run: npm install" });
      return;
    }

    // Build one HTML per tag × copies
    const tags: Array<{ id: string; html: string }> = [];
    for (let c = 0; c < copies; c++) {
      for (const tool of tagsToPrint) {
        tags.push({ id: `${tool.id}-c${c}`, html: buildTagHTML(tool, jsSrc) });
      }
    }

    setPrinting(true);
    setPrintMsg(null);

    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      const data = await res.json();
      const total = tagsToPrint.length * copies;
      setPrintMsg({
        ok: data.ok,
        text: data.ok
          ? `✓ Sent ${total} label${total > 1 ? "s" : ""} to printer`
          : data.message,
      });
    } catch (e: any) {
      setPrintMsg({ ok: false, text: `Connection failed: ${e.message}` });
    } finally {
      setPrinting(false);
      setTimeout(() => setPrintMsg(null), 6000);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Print Tags</h1>
            <p className="text-muted-foreground text-sm mt-1">
              XPrinter XP-T361U · 38 × 28mm · CODE128 · Direct USB
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {printMsg && (
              <p className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                printMsg.ok
                  ? "text-green-400 bg-green-900/20 border-green-700/30"
                  : "text-red-400 bg-red-900/20 border-red-700/30"
              }`}>{printMsg.text}</p>
            )}
            <button
              onClick={handlePrint}
              disabled={selected.size === 0 || printing}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-sm shadow-xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-5 h-5" />
              {printing
                ? `Printing ${tagsToPrint.length * copies} label${tagsToPrint.length * copies > 1 ? "s" : ""}…`
                : `Print ${selected.size > 0 ? `${selected.size} × ${copies} = ${selected.size * copies} label${selected.size * copies > 1 ? "s" : ""}` : "Tags"}`
              }
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-wrap gap-6 items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Copies per tag</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCopies(c => Math.max(1,c-1))} className="w-9 h-9 rounded-xl border border-border font-black hover:bg-muted text-foreground text-lg">−</button>
              <span className="w-8 text-center font-black text-foreground text-lg">{copies}</span>
              <button onClick={() => setCopies(c => Math.min(10,c+1))} className="w-9 h-9 rounded-xl border border-border font-black hover:bg-muted text-foreground text-lg">+</button>
            </div>
          </div>

          <div className="flex-1 min-w-[220px]">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-bold text-foreground mb-1">Direct USB printing</p>
                <p>Each tag is rendered individually — no print dialog needed.</p>
                <p className="mt-1">First time: <strong className="text-foreground">python3 shopshield_print.py --setup</strong></p>
                <p>Check debug: <strong className="text-foreground">eog /tmp/shopshield_last_label.png</strong></p>
              </div>
            </div>
          </div>
        </div>

        {/* Tool list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Search tools…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={selectAll}   className="text-xs text-primary font-black hover:opacity-70 uppercase tracking-widest">Select All</button>
            <button onClick={deselectAll} className="text-xs text-muted-foreground font-black hover:opacity-70 uppercase tracking-widest">Deselect All</button>
            <span className="text-xs text-muted-foreground ml-auto">{selected.size} selected</span>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {filtered.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No tools found</p>}
            {filtered.map(tool => {
              const isSel = selected.has(tool.id);
              return (
                <button key={tool.id} onClick={() => toggle(tool.id)}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 hover:bg-primary/[0.03] transition-colors text-left ${isSel ? "bg-primary/5" : ""}`}>
                  <div className={`flex-shrink-0 ${isSel ? "text-primary" : "text-muted-foreground"}`}>
                    {isSel ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{tool.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{tool.id} · {tool.sku}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                    tool.status === "available"   ? "bg-green-900/40 text-green-400"   :
                    tool.status === "checked-out" ? "bg-blue-900/40 text-blue-400"     :
                    tool.status === "repair"      ? "bg-orange-900/40 text-orange-400" :
                                                    "bg-red-900/40 text-red-400"
                  }`}>{tool.status}</span>
                  {isTech && (
                    <span onClick={e => { e.stopPropagation(); setEditTool(tool); setEditName(tool.name); setEditSku(tool.sku); setEditCat(tool.category); }}
                      className="p-1 rounded-lg bg-green-900/30 text-green-400 hover:bg-green-900/50 flex-shrink-0">
                      <Edit3 className="w-3 h-3"/>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        {tagsToPrint.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5"/> Preview — {tagsToPrint.length} tag{tagsToPrint.length > 1 ? "s" : ""} · 38 × 28mm · {copies} cop{copies > 1 ? "ies" : "y"} = {tagsToPrint.length * copies} labels
            </p>
            <div className="bg-gray-100 rounded-2xl p-4 overflow-x-auto">
              <div className="flex flex-wrap gap-3">
                {tagsToPrint.map(tool => <PreviewTag key={tool.id} tool={tool} />)}
              </div>
            </div>
          </div>
        )}

      </div>
      {editTool && isTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-green-700/30 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-green-400 uppercase tracking-tight">Edit Tag Info</h3>
              <button onClick={() => setEditTool(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Item Name</label>
              <input className="w-full mt-1 bg-input border border-border text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                value={editName} onChange={e => setEditName(e.target.value)} autoFocus/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">SKU / Barcode</label>
              <input className="w-full mt-1 bg-input border border-border text-foreground rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                value={editSku} onChange={e => setEditSku(e.target.value)}/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</label>
              <input className="w-full mt-1 bg-input border border-border text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                value={editCat} onChange={e => setEditCat(e.target.value)}/>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditTool(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground font-black text-xs uppercase hover:text-white">Cancel</button>
              <button onClick={() => { updateTool(editTool.id, {...editTool, name:editName, sku:editSku, category:editCat}); setEditTool(null); }}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-black text-xs uppercase hover:brightness-110">Save</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
