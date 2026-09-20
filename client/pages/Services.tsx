import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useServices, ServiceJob, ServiceStatus, ServiceWorker } from "@/hooks/use-services";
import { useAuth } from "@/hooks/use-auth";
import { useShopSettings } from "@/hooks/use-shop-settings";
import {
  Wrench, Plus, X, Search, User, Phone, ChevronRight, Check,
  Clock, CheckCircle2, XCircle, Loader, DollarSign, Users,
  TrendingUp, TrendingDown, CreditCard, Trash2, Edit3, Calendar
} from "lucide-react";

type Tab = "jobs" | "workers";
type JobModal = "add" | "detail" | null;
type WorkerModal = "add" | "detail" | null;

const STATUS_CONFIG: Record<ServiceStatus, {label:string;color:string;icon:any}> = {
  pending:    {label:"Pending",    color:"bg-yellow-900/40 text-yellow-400 border-yellow-700/30",  icon:Clock},
  in_progress:{label:"In Progress",color:"bg-blue-900/40 text-blue-400 border-blue-700/30",       icon:Loader},
  completed:  {label:"Completed",  color:"bg-green-900/40 text-green-400 border-green-700/30",    icon:CheckCircle2},
  cancelled:  {label:"Cancelled",  color:"bg-muted text-muted-foreground border-border",           icon:XCircle},
};

const PAYMENT_CONFIG = {
  unpaid:  {label:"Unpaid",  color:"text-red-400"},
  partial: {label:"Partial", color:"text-yellow-400"},
  paid:    {label:"Paid",    color:"text-green-400"},
};

export default function Services() {
  const { jobs, workers, transactions, addJob, updateJob, deleteJob, addWorker, updateWorker, addTransaction } = useServices();
  const { user } = useAuth();
  const { settings } = useShopSettings();
  const { user: authUser } = useAuth();
  const isStaff = authUser?.role === 'Staff';
  const sym = settings.currencySymbol || "؋";

  const [tab,         setTab]         = useState<Tab>("jobs");
  const [jobModal,    setJobModal]    = useState<JobModal>(null);
  const [workerModal, setWorkerModal] = useState<WorkerModal>(null);
  const [detailJob,   setDetailJob]   = useState<ServiceJob|null>(null);
  const [detailWorker,setDetailWorker]= useState<ServiceWorker|null>(null);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState<ServiceStatus|"all">("all");

  // ── Job form ──
  const [jForm, setJForm] = useState({
    customerName:"", customerPhone:"", deviceType:"", deviceBrand:"",
    deviceModel:"", issue:"", assignedToId:"", estimatedCost:"", notes:"", status:"pending" as ServiceStatus,
  });

  // ── Worker form ──
  const [wForm, setWForm] = useState({ name:"", phone:"", role:"Technician", active:true });

  // ── Transaction form ──
  const [txAmount, setTxAmount] = useState("");
  const [txDesc,   setTxDesc]   = useState("");
  const [txType,   setTxType]   = useState<"credit"|"debit">("credit");

  const filteredJobs = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter(j => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      return !q || j.customerName.toLowerCase().includes(q) || j.jobNo.toLowerCase().includes(q) || j.deviceType.toLowerCase().includes(q);
    });
  }, [jobs, search, statusFilter]);

  const filteredWorkers = useMemo(() => {
    const q = search.toLowerCase();
    return workers.filter(w => !q || w.name.toLowerCase().includes(q) || w.role.toLowerCase().includes(q));
  }, [workers, search]);

  // Stats
  const pendingCount   = jobs.filter(j => j.status === "pending").length;
  const inProgressCount= jobs.filter(j => j.status === "in_progress").length;
  const completedCount = jobs.filter(j => j.status === "completed").length;
  const totalRevenue   = jobs.filter(j => j.status === "completed").reduce((s,j) => s+(j.finalCost||0), 0);

  const submitJob = () => {
    if (!jForm.customerName || !jForm.deviceType || !jForm.issue) return;
    const worker = workers.find(w => w.id === jForm.assignedToId);
    addJob({
      customerName: jForm.customerName, customerPhone: jForm.customerPhone,
      deviceType: jForm.deviceType, deviceBrand: jForm.deviceBrand,
      deviceModel: jForm.deviceModel, issue: jForm.issue,
      assignedToId: jForm.assignedToId || undefined,
      assignedToName: worker?.name,
      estimatedCost: parseFloat(jForm.estimatedCost) || undefined,
      status: "pending", notes: jForm.notes,
    }, user?.name || "Staff");
    setJForm({customerName:"",customerPhone:"",deviceType:"",deviceBrand:"",deviceModel:"",issue:"",assignedToId:"",estimatedCost:"",notes:"",status:"pending"});
    setJobModal(null);
  };

  const submitWorker = () => {
    if (!wForm.name) return;
    addWorker(wForm);
    setWForm({name:"",phone:"",role:"Technician",active:true});
    setWorkerModal(null);
  };

  const submitTransaction = () => {
    if (!detailWorker || !txAmount) return;
    addTransaction({
      workerId: detailWorker.id, type: txType,
      amount: parseFloat(txAmount), description: txDesc || (txType==="credit"?"Payment":"Advance"),
      date: new Date().toISOString().split("T")[0], createdBy: user?.name || "Staff",
    }, detailWorker.id);
    setTxAmount(""); setTxDesc("");
    // refresh detail
    setDetailWorker(workers.find(w => w.id === detailWorker.id) || null);
  };

  const workerTxns = (workerId: string) => transactions.filter(t => t.workerId === workerId);

  const inp = "w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Services</h1>
            <p className="text-muted-foreground text-sm mt-1">Repair jobs · Staff credit/debit ledger</p>
          </div>
          <button onClick={() => tab==="jobs" ? setJobModal("add") : setWorkerModal("add")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
            <Plus className="w-4 h-4"/> {tab==="jobs" ? "New Job" : "Add Worker"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {label:"Pending",    value:pendingCount,    color:"text-yellow-400"},
            {label:"In Progress",value:inProgressCount, color:"text-blue-400"},
            {label:"Completed",  value:completedCount,  color:"text-green-400"},
            ...(isStaff ? [] : [{label:"Revenue", value:`${sym}${totalRevenue.toFixed(2)}`, color:"text-primary"}]),
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{s.label}</p>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {([["jobs","Jobs"],["workers","Workers"]] as const).map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)}
              className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                tab===k?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"
              }`}>{l}</button>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <input className="w-full bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={tab==="jobs"?"Search jobs…":"Search workers…"}
              value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {tab === "jobs" && (
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)}
              className="bg-card border border-border text-foreground rounded-xl px-3 py-2.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
        </div>

        {/* ── JOBS TAB ── */}
        {tab === "jobs" && (
          <div className="space-y-2">
            {filteredJobs.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl py-16 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3"/>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">
                  {jobs.length===0 ? "No service jobs yet" : "No jobs match filters"}
                </p>
                {jobs.length===0 && (
                  <button onClick={()=>setJobModal("add")} className="mt-4 px-4 py-2 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs">
                    Create First Job
                  </button>
                )}
              </div>
            ) : filteredJobs.map(job => {
              const sc = STATUS_CONFIG[job.status];
              const StatusIcon = sc.icon;
              return (
                <div key={job.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Wrench className="w-5 h-5"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-black text-sm">{job.jobNo}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${sc.color}`}>
                        {sc.label}
                      </span>
                      <span className={`text-[10px] font-black uppercase ${PAYMENT_CONFIG[job.paymentStatus].color}`}>
                        {PAYMENT_CONFIG[job.paymentStatus].label}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-foreground mt-0.5">{job.customerName} · {job.deviceType}{job.deviceBrand?` ${job.deviceBrand}`:""}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.issue}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {job.assignedToName && <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3"/>{job.assignedToName}</span>}
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3"/>{job.dateIn}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {job.finalCost ? <p className="text-primary font-black">{sym}{job.finalCost.toFixed(2)}</p>
                      : job.estimatedCost ? <p className="text-muted-foreground text-sm">~{sym}{job.estimatedCost.toFixed(2)}</p>
                      : null}
                  </div>
                  <button onClick={()=>{setDetailJob(job);setJobModal("detail");}}
                    className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex-shrink-0">
                    <ChevronRight className="w-4 h-4"/>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── WORKERS TAB ── */}
        {tab === "workers" && (
          <div className="space-y-2">
            {filteredWorkers.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl py-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3"/>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">No workers added yet</p>
                <button onClick={()=>setWorkerModal("add")} className="mt-4 px-4 py-2 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs">
                  Add First Worker
                </button>
              </div>
            ) : filteredWorkers.map(w => (
              <div key={w.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 font-black text-lg">
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-black text-sm">{w.name}</p>
                    <span className="text-[10px] font-black uppercase text-muted-foreground border border-border/50 px-1.5 py-0.5 rounded-full">{w.role}</span>
                    {!w.active && <span className="text-[10px] text-red-400 font-black uppercase">Inactive</span>}
                  </div>
                  {w.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3"/>{w.phone}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {workerTxns(w.id).length} transaction{workerTxns(w.id).length!==1?"s":""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-black text-base ${w.balance>=0?"text-green-400":"text-red-400"}`}>
                    {w.balance>=0?"+":""}{sym}{Math.abs(w.balance).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{w.balance>=0?"owed to worker":"worker owes"}</p>
                </div>
                <button onClick={()=>{setDetailWorker(w);setWorkerModal("detail");}}
                  className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex-shrink-0">
                  <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ ADD JOB MODAL ══ */}
      {jobModal === "add" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h3 className="font-black uppercase tracking-tighter text-white text-lg">New Service Job</h3>
              <button onClick={()=>setJobModal(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label-stencil">Customer Name *</label><input className={`${inp} mt-1`} placeholder="Full name" value={jForm.customerName} onChange={e=>setJForm({...jForm,customerName:e.target.value})}/></div>
                <div><label className="label-stencil">Phone</label><input className={`${inp} mt-1`} placeholder="+93…" value={jForm.customerPhone} onChange={e=>setJForm({...jForm,customerPhone:e.target.value})}/></div>
                <div><label className="label-stencil">Device Type *</label><input className={`${inp} mt-1`} placeholder="TV, Phone, CCTV…" value={jForm.deviceType} onChange={e=>setJForm({...jForm,deviceType:e.target.value})}/></div>
                <div><label className="label-stencil">Brand</label><input className={`${inp} mt-1`} placeholder="Samsung, LG…" value={jForm.deviceBrand} onChange={e=>setJForm({...jForm,deviceBrand:e.target.value})}/></div>
                <div><label className="label-stencil">Model</label><input className={`${inp} mt-1`} placeholder="Model number" value={jForm.deviceModel} onChange={e=>setJForm({...jForm,deviceModel:e.target.value})}/></div>
                <div className="col-span-2"><label className="label-stencil">Issue Description *</label><textarea className={`${inp} mt-1 min-h-[72px] resize-none`} placeholder="Describe the problem…" value={jForm.issue} onChange={e=>setJForm({...jForm,issue:e.target.value})}/></div>
                <div>
                  <label className="label-stencil">Assign to Worker</label>
                  <select className={`${inp} mt-1`} value={jForm.assignedToId} onChange={e=>setJForm({...jForm,assignedToId:e.target.value})}>
                    <option value="">Unassigned</option>
                    {workers.filter(w=>w.active).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div><label className="label-stencil">Estimated Cost</label><input className={`${inp} mt-1`} type="number" min="0" step="0.01" placeholder={`0.00 (${sym})`} value={jForm.estimatedCost} onChange={e=>setJForm({...jForm,estimatedCost:e.target.value})}/></div>
                <div className="col-span-2"><label className="label-stencil">Notes</label><input className={`${inp} mt-1`} placeholder="Internal notes…" value={jForm.notes} onChange={e=>setJForm({...jForm,notes:e.target.value})}/></div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-border flex-shrink-0">
              <button onClick={()=>setJobModal(null)} className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-black uppercase tracking-tighter text-xs hover:text-white">Cancel</button>
              <button onClick={submitJob} disabled={!jForm.customerName||!jForm.deviceType||!jForm.issue}
                className="flex-[2] py-3 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-40">
                Create Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ JOB DETAIL MODAL ══ */}
      {jobModal === "detail" && detailJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-black uppercase tracking-tighter text-white">{detailJob.jobNo}</h3>
                <p className="text-xs text-muted-foreground">{detailJob.dateIn} · {detailJob.createdBy}</p>
              </div>
              <button onClick={()=>{setJobModal(null);setDetailJob(null);}} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Customer</p><p className="font-bold text-foreground">{detailJob.customerName}</p></div>
                {detailJob.customerPhone && <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Phone</p><p className="font-bold">{detailJob.customerPhone}</p></div>}
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Device</p><p className="font-bold">{detailJob.deviceType}{detailJob.deviceBrand?` · ${detailJob.deviceBrand}`:""}{detailJob.deviceModel?` · ${detailJob.deviceModel}`:""}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Assigned</p><p className="font-bold">{detailJob.assignedToName||"—"}</p></div>
              </div>
              <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-1">Issue</p><p className="text-sm text-foreground">{detailJob.issue}</p></div>
              {detailJob.notes && <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-1">Notes</p><p className="text-sm text-foreground">{detailJob.notes}</p></div>}

              {/* Status update */}
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Update Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["pending","in_progress","completed","cancelled"] as ServiceStatus[]).map(s => (
                    <button key={s} onClick={()=>updateJob(detailJob.id,{status:s})}
                      className={`py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${
                        detailJob.status===s ? "bg-primary text-white" : "border border-border text-muted-foreground hover:text-foreground"
                      }`}>{STATUS_CONFIG[s].label}</button>
                  ))}
                </div>
              </div>

              {/* Final cost + payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-1">Final Cost</p>
                  <input className={inp} type="number" min="0" step="0.01"
                    placeholder={`${sym}0.00`}
                    defaultValue={detailJob.finalCost||""}
                    onBlur={e=>updateJob(detailJob.id,{finalCost:parseFloat(e.target.value)||undefined})}/>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-1">Payment</p>
                  <select className={inp} value={detailJob.paymentStatus}
                    onChange={e=>updateJob(detailJob.id,{paymentStatus:e.target.value as any})}>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border flex-shrink-0">
              <button onClick={()=>{deleteJob(detailJob.id);setJobModal(null);setDetailJob(null);}}
                className="p-3 rounded-xl border border-red-900/40 text-red-400 hover:bg-red-900/20 transition-colors">
                <Trash2 className="w-4 h-4"/>
              </button>
              <button onClick={()=>{setJobModal(null);setDetailJob(null);}}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ADD WORKER MODAL ══ */}
      {workerModal === "add" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-black uppercase tracking-tighter text-white">Add Worker</h3>
              <button onClick={()=>setWorkerModal(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-3">
              <div><label className="label-stencil">Full Name *</label><input className={`${inp} mt-1`} placeholder="Worker name" value={wForm.name} onChange={e=>setWForm({...wForm,name:e.target.value})}/></div>
              <div><label className="label-stencil">Phone</label><input className={`${inp} mt-1`} placeholder="+93…" value={wForm.phone} onChange={e=>setWForm({...wForm,phone:e.target.value})}/></div>
              <div>
                <label className="label-stencil">Role</label>
                <select className={`${inp} mt-1`} value={wForm.role} onChange={e=>setWForm({...wForm,role:e.target.value})}>
                  <option>Technician</option><option>Helper</option><option>Electrician</option><option>Plumber</option><option>Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={()=>setWorkerModal(null)} className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-black text-xs uppercase hover:text-white">Cancel</button>
              <button onClick={submitWorker} disabled={!wForm.name}
                className="flex-[2] py-3 rounded-xl bg-primary text-white font-black uppercase text-xs shadow-lg hover:brightness-110 disabled:opacity-40">Add Worker</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ WORKER DETAIL MODAL ══ */}
      {workerModal === "detail" && detailWorker && (() => {
        const w = workers.find(x => x.id === detailWorker.id) || detailWorker;
        const txns = workerTxns(w.id);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <div>
                  <h3 className="font-black uppercase tracking-tighter text-white">{w.name}</h3>
                  <p className="text-xs text-muted-foreground">{w.role} · Since {w.dateAdded}</p>
                </div>
                <button onClick={()=>{setWorkerModal(null);setDetailWorker(null);}} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-5 space-y-5 overflow-y-auto">
                {/* Balance */}
                <div className={`rounded-2xl p-4 text-center ${w.balance>=0?"bg-green-900/20 border border-green-700/30":"bg-red-900/20 border border-red-700/30"}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Current Balance</p>
                  <p className={`text-3xl font-black ${w.balance>=0?"text-green-400":"text-red-400"}`}>
                    {w.balance>=0?"+":""}{sym}{Math.abs(w.balance).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{w.balance>=0?"We owe this to the worker":"Worker owes us"}</p>
                </div>

                {/* Add transaction */}
                <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Add Transaction</p>
                  <div className="flex gap-2">
                    <button onClick={()=>setTxType("credit")}
                      className={`flex-1 py-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 transition-all ${txType==="credit"?"bg-green-700 text-white":"border border-border text-muted-foreground hover:text-foreground"}`}>
                      <TrendingUp className="w-3 h-3"/> Credit
                    </button>
                    <button onClick={()=>setTxType("debit")}
                      className={`flex-1 py-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1 transition-all ${txType==="debit"?"bg-red-700 text-white":"border border-border text-muted-foreground hover:text-foreground"}`}>
                      <TrendingDown className="w-3 h-3"/> Debit
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input className={`${inp} flex-1`} type="number" min="0" step="0.01" placeholder={`Amount (${sym})`} value={txAmount} onChange={e=>setTxAmount(e.target.value)}/>
                    <input className={`${inp} flex-[2]`} placeholder="Description" value={txDesc} onChange={e=>setTxDesc(e.target.value)}/>
                  </div>
                  <button onClick={submitTransaction} disabled={!txAmount}
                    className="w-full py-2.5 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110 disabled:opacity-40">
                    Record Transaction
                  </button>
                </div>

                {/* Transaction history */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Transaction History</p>
                  {txns.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No transactions yet</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {txns.map(t => (
                        <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${t.type==="credit"?"bg-green-900/40 text-green-400":"bg-red-900/40 text-red-400"}`}>
                            {t.type==="credit"?<TrendingUp className="w-3.5 h-3.5"/>:<TrendingDown className="w-3.5 h-3.5"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{t.description}</p>
                            <p className="text-[10px] text-muted-foreground">{t.date} · {t.createdBy}</p>
                          </div>
                          <span className={`text-sm font-black flex-shrink-0 ${t.type==="credit"?"text-green-400":"text-red-400"}`}>
                            {t.type==="credit"?"+":"-"}{sym}{t.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 pb-5 border-t border-border pt-4 flex gap-3 flex-shrink-0">
                <button onClick={()=>updateWorker(w.id,{active:!w.active})}
                  className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground font-black text-xs uppercase hover:text-foreground">
                  {w.active?"Deactivate":"Reactivate"}
                </button>
                <button onClick={()=>{setWorkerModal(null);setDetailWorker(null);}}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-black text-xs uppercase">Done</button>
              </div>
            </div>
          </div>
        );
      })()}

    </Layout>
  );
}
