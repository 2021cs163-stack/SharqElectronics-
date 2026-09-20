import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useActivityLog, ActivityType } from "@/hooks/use-activity-log";
import { useAuth } from "@/hooks/use-auth";
import { Search, Trash2, Filter, Clock, User, Edit3, Package, Receipt, LogIn } from "lucide-react";

const TYPE_STYLE: Record<ActivityType, {label:string;color:string;icon:any}> = {
  edit:    {label:"Edit",    color:"text-yellow-400", icon:Edit3},
  delete:  {label:"Delete",  color:"text-red-400",    icon:Trash2},
  sale:    {label:"Sale",    color:"text-green-400",  icon:Receipt},
  login:   {label:"Login",   color:"text-blue-400",   icon:LogIn},
  logout:  {label:"Logout",  color:"text-muted-foreground", icon:LogIn},
  add:     {label:"Add",     color:"text-primary",    icon:Package},
  note:    {label:"Note",    color:"text-purple-400", icon:Edit3},
};

export default function ActivityLog() {
  const { entries, clearLog } = useActivityLog();
  const { user } = useAuth();
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<ActivityType|"all">("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const isPartner = user?.role === "Partner";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      return !q || e.userName.toLowerCase().includes(q) || e.target.toLowerCase().includes(q) || e.action.toLowerCase().includes(q);
    });
  }, [entries, search, typeFilter]);

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Activity Log</h1>
            <p className="text-muted-foreground text-sm mt-1">{filtered.length} of {entries.length} entries</p>
          </div>
          {isPartner && (
            confirmClear ? (
              <div className="flex gap-2">
                <button onClick={()=>setConfirmClear(false)} className="px-3 py-2 rounded-xl border border-border text-muted-foreground text-xs font-black">Cancel</button>
                <button onClick={()=>{clearLog();setConfirmClear(false);}} className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-black">Clear All</button>
              </div>
            ) : (
              <button onClick={()=>setConfirmClear(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-900/40 text-red-400 text-xs font-black hover:bg-red-900/20">
                <Trash2 className="w-3.5 h-3.5"/> Clear Log
              </button>
            )
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input className="w-full bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search user, action, target…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value as any)}
            className="bg-card border border-border text-foreground rounded-xl px-3 py-2.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">All Types</option>
            {(Object.keys(TYPE_STYLE) as ActivityType[]).map(t => (
              <option key={t} value={t}>{TYPE_STYLE[t].label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl py-16 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3"/>
              <p className="text-muted-foreground text-sm">No activity yet</p>
            </div>
          ) : filtered.map(e => {
            const cfg = TYPE_STYLE[e.type] ?? TYPE_STYLE.note;
            const Icon = cfg.icon;
            return (
              <div key={e.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-card flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-current/20 ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-sm font-bold text-foreground truncate">{e.target}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{e.action}</p>
                    {e.reason && (
                      <p className="text-xs text-yellow-400 mt-1 italic">Reason: {e.reason}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <User className="w-3 h-3"/>{e.userName} ({e.userRole})
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3"/>{e.date} {e.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
