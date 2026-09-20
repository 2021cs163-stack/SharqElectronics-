import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useProjects, Project, ProjectStatus } from "@/hooks/use-projects";
import { useServices } from "@/hooks/use-services";
import { useAuth } from "@/hooks/use-auth";
import { useShopSettings } from "@/hooks/use-shop-settings";
import {
  FolderKanban, Plus, X, Search, ChevronRight, Calendar, User, Phone,
  Package, Wrench, CheckCircle2, Clock, AlertTriangle, Trash2, Link,
  Check, Circle, CircleDashed
} from "lucide-react";

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  planning:  { label:"Planning",   color:"bg-yellow-900/40 text-yellow-400 border-yellow-700/30"  },
  active:    { label:"Active",     color:"bg-blue-900/40 text-blue-400 border-blue-700/30"        },
  on_hold:   { label:"On Hold",    color:"bg-orange-900/40 text-orange-400 border-orange-700/30"  },
  completed: { label:"Completed",  color:"bg-green-900/40 text-green-400 border-green-700/30"     },
  cancelled: { label:"Cancelled",  color:"bg-muted text-muted-foreground border-border"            },
};

export default function Projects() {
  const { projects, addProject, updateProject, deleteProject,
    addMaterial, updateMaterial, deleteMaterial,
    addService, updateService, linkJob, unlinkJob } = useProjects();
  const { jobs } = useServices();
  const { user } = useAuth();
  const { settings } = useShopSettings();
  const sym = settings.currencySymbol || "؋";

  const isPartner = user?.role === "Partner";
  const isTech    = user?.role === "Tech";
  const canManage = isPartner || isTech;

  const [search, setSearch]     = useState("");
  const [statusFilter, setSF]   = useState<ProjectStatus | "all">("all");
  const [showAdd, setShowAdd]   = useState(false);
  const [detail, setDetail]     = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<"overview"|"materials"|"services"|"jobs">("overview");

  const [form, setForm] = useState({
    name:"", customerName:"", customerPhone:"", address:"",
    description:"", status:"planning" as ProjectStatus,
    startDate: new Date().toISOString().split("T")[0],
    dueDate:"", estimatedTotal:"", notes:"",
  });

  const [matForm, setMatForm] = useState({ name:"", quantity:"1", unit:"piece", estimatedCost:"", notes:"" });
  const [svcForm, setSvcForm] = useState({ description:"", assignedTo:"", estimatedCost:"" });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return !q || p.name.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q) || p.projectNo.toLowerCase().includes(q);
    });
  }, [projects, search, statusFilter]);

  const submit = () => {
    if (!form.name || !form.customerName || !form.description) return;
    addProject({ ...form, estimatedTotal: parseFloat(form.estimatedTotal) || undefined }, user?.name || "Staff");
    setForm({ name:"",customerName:"",customerPhone:"",address:"",description:"",status:"planning",
      startDate:new Date().toISOString().split("T")[0], dueDate:"",estimatedTotal:"",notes:"" });
    setShowAdd(false);
  };

  const inp = "w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  const currentDetail = detail ? projects.find(p => p.id === detail.id) || detail : null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">Installation & service projects · Materials · Tasks</p>
          </div>
          {canManage && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
              <Plus className="w-4 h-4"/> New Project
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["planning","active","on_hold","completed"] as ProjectStatus[]).map(s => (
            <div key={s} className="bg-card border border-border rounded-2xl p-4 text-center cursor-pointer hover:border-primary/30 transition-all"
              onClick={() => setSF(statusFilter === s ? "all" : s)}>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{STATUS_CONFIG[s].label}</p>
              <p className="text-2xl font-black mt-1 text-foreground">{projects.filter(p=>p.status===s).length}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input className="w-full bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <select value={statusFilter} onChange={e => setSF(e.target.value as any)}
            className="bg-card border border-border text-foreground rounded-xl px-3 py-2.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl py-16 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3"/>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">No projects yet</p>
              {canManage && <button onClick={() => setShowAdd(true)} className="mt-4 px-4 py-2 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs">Create First Project</button>}
            </div>
          ) : filtered.map(p => {
            const sc = STATUS_CONFIG[p.status];
            const matDone = p.materials.filter(m=>m.procured).length;
            const svcDone = p.services.filter(s=>s.status==="done").length;
            return (
              <div key={p.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <FolderKanban className="w-5 h-5"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-black text-sm">{p.projectNo}</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground mt-0.5">{p.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="w-3 h-3"/>{p.customerName}</span>
                    <span className="flex items-center gap-1"><Package className="w-3 h-3"/>{matDone}/{p.materials.length} materials</span>
                    <span className="flex items-center gap-1"><Wrench className="w-3 h-3"/>{svcDone}/{p.services.length} tasks</span>
                    {p.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>Due {p.dueDate}</span>}
                  </div>
                </div>
                {!isPartner ? null : (
                  <div className="text-right flex-shrink-0">
                    {p.estimatedTotal && <p className="text-sm font-black text-muted-foreground">~{sym}{p.estimatedTotal.toFixed(0)}</p>}
                    {p.actualTotal && <p className="text-primary font-black">{sym}{p.actualTotal.toFixed(0)}</p>}
                  </div>
                )}
                <button onClick={() => { setDetail(p); setDetailTab("overview"); }}
                  className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex-shrink-0">
                  <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ ADD MODAL ══ */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h3 className="font-black uppercase tracking-tighter text-white text-lg">New Project</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label-stencil">Project Name *</label><input className={`${inp} mt-1`} placeholder="e.g. CCTV Installation – Ahmad" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
                <div><label className="label-stencil">Customer *</label><input className={`${inp} mt-1`} placeholder="Customer name" value={form.customerName} onChange={e=>setForm({...form,customerName:e.target.value})}/></div>
                <div><label className="label-stencil">Phone</label><input className={`${inp} mt-1`} placeholder="+93…" value={form.customerPhone} onChange={e=>setForm({...form,customerPhone:e.target.value})}/></div>
                <div className="col-span-2"><label className="label-stencil">Address</label><input className={`${inp} mt-1`} placeholder="Job site address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></div>
                <div className="col-span-2"><label className="label-stencil">Description *</label><textarea className={`${inp} mt-1 min-h-[64px] resize-none`} placeholder="What does this project involve?" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
                <div><label className="label-stencil">Status</label>
                  <select className={`${inp} mt-1`} value={form.status} onChange={e=>setForm({...form,status:e.target.value as ProjectStatus})}>
                    {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                {!isPartner ? null : <div><label className="label-stencil">Est. Total</label><input className={`${inp} mt-1`} type="number" min="0" placeholder={`0 ${sym}`} value={form.estimatedTotal} onChange={e=>setForm({...form,estimatedTotal:e.target.value})}/></div>}
                <div><label className="label-stencil">Start Date</label><input className={`${inp} mt-1`} type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></div>
                <div><label className="label-stencil">Due Date</label><input className={`${inp} mt-1`} type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></div>
                <div className="col-span-2"><label className="label-stencil">Notes</label><input className={`${inp} mt-1`} placeholder="Internal notes…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-border flex-shrink-0">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-black uppercase tracking-tighter text-xs hover:text-white">Cancel</button>
              <button onClick={submit} disabled={!form.name||!form.customerName||!form.description}
                className="flex-[2] py-3 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs shadow-lg hover:brightness-110 disabled:opacity-40">Create Project</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DETAIL MODAL ══ */}
      {currentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-black uppercase tracking-tighter text-white">{currentDetail.projectNo} · {currentDetail.name}</h3>
                <p className="text-xs text-muted-foreground">{currentDetail.customerName} · {currentDetail.dateCreated}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            {/* Detail tabs */}
            <div className="flex gap-1 bg-muted/30 p-1 mx-4 mt-3 rounded-xl flex-shrink-0">
              {(["overview","materials","services","jobs"] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    detailTab===t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}>{t}</button>
              ))}
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {detailTab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { l:"Status", v: <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS_CONFIG[currentDetail.status].color}`}>{STATUS_CONFIG[currentDetail.status].label}</span> },
                      { l:"Customer", v:currentDetail.customerName },
                      { l:"Phone", v:currentDetail.customerPhone||"—" },
                      { l:"Address", v:currentDetail.address||"—" },
                      { l:"Start", v:currentDetail.startDate },
                      { l:"Due", v:currentDetail.dueDate||"—" },
                    ].map(({l,v}) => (
                      <div key={l}><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-0.5">{l}</p><p className="font-bold text-foreground">{v}</p></div>
                    ))}
                  </div>
                  <div><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Description</p><p className="text-sm">{currentDetail.description}</p></div>
                  {canManage && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-2">Update Status</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(STATUS_CONFIG) as ProjectStatus[]).map(s => (
                          <button key={s} onClick={() => updateProject(currentDetail.id, {status:s})}
                            className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${
                              currentDetail.status===s ? "bg-primary text-white" : "border border-border text-muted-foreground hover:text-foreground"
                            }`}>{STATUS_CONFIG[s].label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === "materials" && (
                <div className="space-y-3">
                  {canManage && (
                    <div className="flex gap-2 flex-wrap">
                      <input className={`${inp} flex-1 min-w-[120px]`} placeholder="Material name" value={matForm.name} onChange={e=>setMatForm({...matForm,name:e.target.value})}/>
                      <input className="bg-input border border-border text-foreground rounded-xl px-3 py-2.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-primary" type="number" min="0" placeholder="Qty" value={matForm.quantity} onChange={e=>setMatForm({...matForm,quantity:e.target.value})}/>
                      <input className="bg-input border border-border text-foreground rounded-xl px-3 py-2.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Unit" value={matForm.unit} onChange={e=>setMatForm({...matForm,unit:e.target.value})}/>
                      <button onClick={() => { if(!matForm.name) return; addMaterial(currentDetail.id, {...matForm, quantity:parseFloat(matForm.quantity)||1, estimatedCost:parseFloat(matForm.estimatedCost)||undefined, procured:false}); setMatForm({name:"",quantity:"1",unit:"piece",estimatedCost:"",notes:""}); }}
                        disabled={!matForm.name} className="px-4 py-2.5 rounded-xl bg-primary text-white font-black text-xs uppercase disabled:opacity-40 hover:brightness-110"><Plus className="w-4 h-4"/></button>
                    </div>
                  )}
                  {currentDetail.materials.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No materials added yet</p>
                  ) : currentDetail.materials.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      {canManage && (
                        <button onClick={() => updateMaterial(currentDetail.id, m.id, {procured:!m.procured})}
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${m.procured ? "bg-green-700 text-white" : "border-2 border-border text-muted-foreground hover:border-primary"}`}>
                          {m.procured ? <Check className="w-3.5 h-3.5"/> : <Circle className="w-3.5 h-3.5"/>}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${m.procured ? "line-through text-muted-foreground" : "text-foreground"}`}>{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.quantity} {m.unit}{m.estimatedCost ? ` · ~${sym}${m.estimatedCost}` : ""}</p>
                      </div>
                      {canManage && <button onClick={() => deleteMaterial(currentDetail.id, m.id)} className="text-red-400/50 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>}
                    </div>
                  ))}
                </div>
              )}

              {detailTab === "services" && (
                <div className="space-y-3">
                  {canManage && (
                    <div className="flex gap-2 flex-wrap">
                      <input className={`${inp} flex-1 min-w-[160px]`} placeholder="Service / task description" value={svcForm.description} onChange={e=>setSvcForm({...svcForm,description:e.target.value})}/>
                      <input className="bg-input border border-border text-foreground rounded-xl px-3 py-2.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Assigned to" value={svcForm.assignedTo} onChange={e=>setSvcForm({...svcForm,assignedTo:e.target.value})}/>
                      <button onClick={() => { if(!svcForm.description) return; addService(currentDetail.id, {...svcForm, estimatedCost:parseFloat(svcForm.estimatedCost)||undefined, status:"pending"}); setSvcForm({description:"",assignedTo:"",estimatedCost:""}); }}
                        disabled={!svcForm.description} className="px-4 py-2.5 rounded-xl bg-primary text-white font-black text-xs uppercase disabled:opacity-40 hover:brightness-110"><Plus className="w-4 h-4"/></button>
                    </div>
                  )}
                  {currentDetail.services.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No tasks added yet</p>
                  ) : currentDetail.services.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      {canManage && (
                        <button onClick={() => updateService(currentDetail.id, s.id, {status: s.status==="done" ? "pending" : s.status==="pending" ? "in_progress" : "done"})}
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.status==="done" ? "bg-green-700 text-white" : s.status==="in_progress" ? "bg-blue-700 text-white" : "border-2 border-border text-muted-foreground hover:border-primary"}`}>
                          {s.status==="done" ? <Check className="w-3.5 h-3.5"/> : s.status==="in_progress" ? <Clock className="w-3.5 h-3.5"/> : <CircleDashed className="w-3.5 h-3.5"/>}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${s.status==="done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{s.description}</p>
                        {s.assignedTo && <p className="text-xs text-muted-foreground">{s.assignedTo}</p>}
                      </div>
                      {canManage && <button onClick={() => updateService(currentDetail.id, s.id, {})} className="text-muted-foreground"><span className="text-[10px] font-black uppercase">{s.status}</span></button>}
                    </div>
                  ))}
                </div>
              )}

              {detailTab === "jobs" && (
                <div className="space-y-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Linked Service Jobs</p>
                  {currentDetail.linkedJobIds.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">No jobs linked yet</p>
                  ) : currentDetail.linkedJobIds.map(jid => {
                    const job = jobs.find(j => j.id === jid);
                    return job ? (
                      <div key={jid} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                        <Wrench className="w-4 h-4 text-primary flex-shrink-0"/>
                        <div className="flex-1">
                          <p className="text-sm font-bold">{job.jobNo} · {job.customerName}</p>
                          <p className="text-xs text-muted-foreground">{job.deviceType} · {job.issue.slice(0,50)}</p>
                        </div>
                        {canManage && <button onClick={() => unlinkJob(currentDetail.id, jid)} className="text-red-400/50 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>}
                      </div>
                    ) : null;
                  })}
                  {canManage && jobs.filter(j => !currentDetail.linkedJobIds.includes(j.id)).length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-4 mb-2">Link a Service Job</p>
                      {jobs.filter(j => !currentDetail.linkedJobIds.includes(j.id)).slice(0,5).map(j => (
                        <button key={j.id} onClick={() => linkJob(currentDetail.id, j.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border hover:border-primary/50 transition-all mb-2 text-left">
                          <Link className="w-4 h-4 text-muted-foreground flex-shrink-0"/>
                          <div className="flex-1">
                            <p className="text-sm font-bold">{j.jobNo} · {j.customerName}</p>
                            <p className="text-xs text-muted-foreground">{j.deviceType}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-border flex-shrink-0">
              {canManage && (
                <button onClick={() => { deleteProject(currentDetail.id); setDetail(null); }}
                  className="p-3 rounded-xl border border-red-900/40 text-red-400 hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4"/>
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
