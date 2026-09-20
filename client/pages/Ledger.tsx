import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useLedger, LedgerEntry } from "@/hooks/use-ledger";
import { useAuth } from "@/hooks/use-auth";
import { Search, Download, CheckCircle2, Clock, AlertTriangle, RotateCcw } from "lucide-react";

const actionColors: Record<string, string> = {
  "Tool Added":                    "text-blue-400",
  "Checked Out":                   "text-primary",
  "Returned":                      "text-green-400",
  "Repair Logged":                 "text-orange-400",
  "Repair Complete":               "text-green-400",
  "Assigned Loss":                 "text-red-400",
  "Corrective Adjustment":         "text-purple-400",
  "Day Closed - Clean":            "text-green-400",
  "Day Closed - With Assignments": "text-orange-400",
  "Disposed":                      "text-red-400",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "signed")    return <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />;
  if (status === "pending")   return <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 animate-pulse" />;
  if (status === "warning")   return <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  if (status === "corrected") return <RotateCcw className="w-4 h-4 text-purple-400 flex-shrink-0" />;
  return null;
}

export default function Ledger() {
  const { ledger, approveEntry, approveAllPending } = useLedger();
  const { user } = useAuth();
  const [search, setSearch]   = useState("");
  const [date, setDate]       = useState("");
  const [statusF, setStatusF] = useState("all");

  const pendingEntries = ledger.filter(e => e.status === "pending");

  const filtered = useMemo(() => ledger.filter(e => {
    const q = search.toLowerCase();
    return (!q || e.toolName.toLowerCase().includes(q) || e.userName.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) || e.toolId.toLowerCase().includes(q))
      && (!date || e.date === date)
      && (statusF === "all" || e.status === statusF);
  }), [ledger, search, date, statusF]);

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, LedgerEntry[]> = {};
    filtered.forEach(e => { if (!map[e.date]) map[e.date] = []; map[e.date].push(e); });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const exportCSV = () => {
    const rows = [["ID","Date","Time","User","Role","Action","Tool","From","To","Status","Signed By","Cost","Notes"],
      ...filtered.map(e => [e.id,e.date,e.timestamp,e.userName,e.userRole,e.action,e.toolName,e.fromLocation||"",e.toLocation||"",e.status,e.signedBy||"",e.costAtTime||"",e.notes||""])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = `ledger-${new Date().toISOString().split("T")[0]}.csv`; a.click();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Audit Ledger</h1>
            <p className="text-muted-foreground text-sm mt-1">Immutable append-only record · {ledger.length} total entries</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {user?.role === "Partner" && pendingEntries.length > 0 && (
              <button onClick={() => approveAllPending(user)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 text-white font-black uppercase tracking-tighter text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all">
                <CheckCircle2 className="w-4 h-4" /> Approve All ({pendingEntries.length})
              </button>
            )}
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border font-black uppercase tracking-tighter text-xs hover:border-primary/50 transition-all">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input className="w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search tool, user, action…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <input type="date" className="bg-input border border-border text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-40"
            value={date} onChange={e => setDate(e.target.value)} />
          <select className="bg-input border border-border text-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={statusF} onChange={e => setStatusF(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="signed">Signed</option>
            <option value="pending">Pending</option>
            <option value="warning">Warning</option>
            <option value="corrected">Corrected</option>
          </select>
        </div>

        {/* Grouped entries */}
        {grouped.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <p className="text-muted-foreground text-sm">No ledger entries found. Start scanning tools to build your audit trail.</p>
          </div>
        ) : grouped.map(([date, entries]) => (
          <div key={date} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-widest text-foreground">{date}</p>
              <p className="text-xs text-muted-foreground font-bold">{entries.length} entries</p>
            </div>
            <div className="divide-y divide-border">
              {entries.map(e => (
                <div key={e.id} className={`flex items-start gap-4 px-6 py-4 hover:bg-primary/[0.02] transition-colors ${e.status === "corrected" ? "opacity-60" : ""}`}>
                  <div className="mt-0.5"><StatusIcon status={e.status} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-black uppercase tracking-tighter ${actionColors[e.action] || "text-foreground"}`}>{e.action}</span>
                      {e.status === "corrected" && <span className="text-[10px] text-purple-400 font-black uppercase tracking-widest">[CORRECTED]</span>}
                    </div>
                    <p className="text-sm text-foreground mt-0.5">
                      {e.toolName} {e.toolId !== "SYSTEM" && <span className="text-xs text-muted-foreground font-mono">({e.toolId})</span>}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <p className="text-xs text-muted-foreground">By <strong className="text-foreground">{e.userName}</strong> ({e.userRole})</p>
                      {e.fromLocation && e.toLocation && <p className="text-xs text-muted-foreground">{e.fromLocation} → {e.toLocation}</p>}
                      {e.signedBy   && <p className="text-xs text-green-400 font-bold">Signed by {e.signedBy}</p>}
                      {e.notes      && <p className="text-xs text-muted-foreground italic">"{e.notes}"</p>}
                      {e.costAtTime && <p className="text-xs text-muted-foreground">Cost: ${Number(e.costAtTime).toFixed(2)}</p>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                    <p className="text-xs text-muted-foreground">{e.timestamp}</p>
                    <p className="text-[10px] font-mono text-muted-foreground/40">{e.id}</p>
                    {e.status === "pending" && user?.role === "Partner" && (
                      <button onClick={() => approveEntry(e.id, user)}
                        className="text-[10px] px-3 py-1 rounded-lg bg-primary text-white font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
