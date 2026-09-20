import { appStorage, flushCloudData, DATA_KEYS } from '@/lib/app-storage';
import { supabaseConfigured } from '@/lib/supabase';
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { useLedger } from "@/hooks/use-ledger";
import { useAuth } from "@/hooks/use-auth";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { useState } from "react";
import {
  HardDrive, Cloud, Database, Trash2, Download, Upload,
  CheckCircle2, AlertTriangle, Shield, Store,
  Phone, MapPin, Mail, FileText, DollarSign
} from "lucide-react";

// Every localStorage key used across the whole app
const ALL_KEYS = [
  'shopshield_tools', 'shopshield_ledger', 'shopshield_day_state',
  'shopshield_bills', 'shopshield_customers',
  'shopshield_service_jobs', 'shopshield_service_workers', 'shopshield_worker_txns',
  'shopshield_txs', 'shopshield_transactions',
];
// Keys to keep after reset (users stay logged in, shop settings kept)
const KEEP_KEYS = ['shopshield_session', 'shopshield_users', 'shopshield_shop_settings'];

export default function Settings() {
  const { tools, ledger, resetAllData } = useLedger();
  const { user } = useAuth();
  const { settings: shopSettings, updateSettings } = useShopSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const [backupMsg,    setBackupMsg]    = useState("");

  const handleBackup = (label: string) => {
    const data = {
      data: Object.fromEntries(DATA_KEYS.map(key => [key, appStorage.getItem(key)]).filter(([, value]) => value !== null)),
      tools, ledger,
      exportedAt: new Date().toISOString(), exportedBy: user?.name,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shopshield-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    setBackupMsg(label);
    setTimeout(() => setBackupMsg(""), 3000);
  };

  const handleFullReset = () => {
    // 1. Clear all data keys
    ALL_KEYS.forEach(k => appStorage.removeItem(k));
    // 2. Also call the ledger hook's reset (clears React state)
    resetAllData();
    setConfirmReset(false);
    // 3. Reload page so all hooks reinitialise with empty state
    setTimeout(() => { void flushCloudData().then(() => window.location.reload()).catch(() => {}); }, 100);
  };

  const dbSize = Math.round(JSON.stringify({ tools, ledger }).length / 1024);

  const inp = "w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Layout>
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-card border border-red-700/50 rounded-2xl w-full max-w-sm p-6 text-center space-y-4 shadow-2xl">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto"/>
            <h3 className="font-black text-lg uppercase tracking-tighter text-foreground">Wipe Everything?</h3>
            <p className="text-sm text-muted-foreground">
              All tools, ledger, bills, customers, service jobs and worker records will be
              permanently deleted. Shop settings and user accounts are kept.
              <br/><br/><strong className="text-red-400">This cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-black uppercase tracking-tighter hover:bg-muted">Cancel</button>
              <button onClick={handleFullReset}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-black uppercase tracking-tighter">
                Wipe All Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Shop profile · Backup · System configuration</p>
        </div>

        {/* ── Shop Profile ── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Store className="w-4 h-4 text-primary"/>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shop Profile — printed on every bill</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><label className="label-stencil">Shop Name *</label>
              <input className={`${inp} mt-1 font-bold`} value={shopSettings.shopName} onChange={e=>updateSettings({shopName:e.target.value})} placeholder="Sharq Electronics"/></div>
            <div className="space-y-1"><label className="label-stencil">Tagline</label>
              <input className={`${inp} mt-1`} value={shopSettings.shopTagline} onChange={e=>updateSettings({shopTagline:e.target.value})} placeholder="Quality Electronics…"/></div>
            <div className="space-y-1"><label className="label-stencil flex items-center gap-1"><MapPin className="w-3 h-3"/> Address</label>
              <input className={`${inp} mt-1`} value={shopSettings.shopAddress} onChange={e=>updateSettings({shopAddress:e.target.value})} placeholder="Main Bazaar, Shop No. 12"/></div>
            <div className="space-y-1"><label className="label-stencil">City / Country</label>
              <input className={`${inp} mt-1`} value={shopSettings.shopCity} onChange={e=>updateSettings({shopCity:e.target.value})} placeholder="Kabul, Afghanistan"/></div>
            <div className="space-y-1"><label className="label-stencil flex items-center gap-1"><Phone className="w-3 h-3"/> Phone 1 *</label>
              <input className={`${inp} mt-1`} value={shopSettings.shopPhone} onChange={e=>updateSettings({shopPhone:e.target.value})} placeholder="+93 700 000 000"/></div>
            <div className="space-y-1"><label className="label-stencil flex items-center gap-1"><Phone className="w-3 h-3"/> Phone 2</label>
              <input className={`${inp} mt-1`} value={shopSettings.shopPhone2} onChange={e=>updateSettings({shopPhone2:e.target.value})} placeholder="Optional"/></div>
            <div className="space-y-1"><label className="label-stencil flex items-center gap-1"><Mail className="w-3 h-3"/> Email</label>
              <input className={`${inp} mt-1`} value={shopSettings.shopEmail} onChange={e=>updateSettings({shopEmail:e.target.value})} placeholder="shop@email.com"/></div>
            <div className="space-y-1"><label className="label-stencil flex items-center gap-1"><FileText className="w-3 h-3"/> Tax ID / TIN</label>
              <input className={`${inp} mt-1`} value={shopSettings.shopTaxId} onChange={e=>updateSettings({shopTaxId:e.target.value})} placeholder="Optional"/></div>
            <div className="space-y-1"><label className="label-stencil flex items-center gap-1"><DollarSign className="w-3 h-3"/> Currency Symbol</label>
              <input className={`${inp} mt-1 font-bold`} value={shopSettings.currencySymbol} onChange={e=>updateSettings({currencySymbol:e.target.value})} placeholder="؋"/></div>
            <div className="space-y-1"><label className="label-stencil">USD Exchange Rate (1$ = ? Af)</label>
              <input type="number" min="1" className={`${inp} mt-1 font-bold`} value={shopSettings.usdRate??70} onChange={e=>updateSettings({usdRate:parseFloat(e.target.value)||70})} placeholder="70"/></div>
            <div className="space-y-1 md:col-span-2"><label className="label-stencil">Active Currency for Bills & Pricing</label>
              <div className="flex gap-3 mt-1">
                {(['Af','USD'] as const).map(cur => (
                  <button key={cur} onClick={()=>updateSettings({activeCurrency:cur, currencySymbol:cur==='Af'?'؋':'$'})}
                    className={`flex-1 py-3 rounded-xl border font-black uppercase tracking-widest text-sm transition-all ${
                      shopSettings.activeCurrency===cur ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}>{cur==='Af'?'؋ Afghani (Af)':'$ US Dollar (USD)'}</button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Switching currency updates symbol on all new bills. Old bills are unchanged.</p>
            </div>
            <div className="space-y-1 md:col-span-2"><label className="label-stencil">Receipt Footer (one line per row)</label>
              <textarea className={`${inp} mt-1 min-h-[64px] resize-y`}
                value={shopSettings.receiptFooter} onChange={e=>updateSettings({receiptFooter:e.target.value})}
                placeholder={"Thank you for your business!\nPlease come again."}/></div>
          </div>
          <div className="px-5 pb-4">
            <p className="text-[10px] text-muted-foreground">Changes are saved automatically to every bill.</p>
          </div>
        </div>


        {/* ── Theme ── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">App Theme</p>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {([
              {id:'dark',  label:'Dark',  bg:'bg-gray-900',  ring:'ring-gray-600'},
              {id:'blue',  label:'Blue',  bg:'bg-blue-950',  ring:'ring-blue-500'},
              {id:'green', label:'Green', bg:'bg-emerald-950',ring:'ring-emerald-500'},
              {id:'rose',  label:'Rose',  bg:'bg-rose-950',  ring:'ring-rose-500'},
              {id:'light', label:'Light', bg:'bg-gray-100',  ring:'ring-gray-400'},
            ] as const).map(t => (
              <button key={t.id} onClick={()=>updateSettings({theme:t.id})}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  shopSettings.theme===t.id ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/30'
                }`}>
                <div className={`w-10 h-6 rounded-lg ${t.bg} ${t.ring} ring-1`}/>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        {/* ── Import ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary"/> Historical Data Import
          </h2>
          <p className="text-sm text-muted-foreground mb-3">Import your August 2025 Excel sales ledger into billing history.</p>
          <Link to="/import-ledger"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-black uppercase hover:bg-primary/20 w-fit">
            Import Excel Ledger →
          </Link>
        </div>

        {/* ── DB Status ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary"/> Database Status
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[["Tools",tools.length],["Ledger Entries",ledger.length],["DB Size",`~${dbSize} KB`],["Storage",supabaseConfigured ? "Supabase" : "localStorage"]].map(([l,v])=>(
              <div key={String(l)} className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-foreground">{v}</p>
                <p className="text-xs text-muted-foreground mt-1 font-bold uppercase tracking-widest">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Backup ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary"/> Backup
          </h2>
          <div className="space-y-3">
            {[
              {icon:HardDrive,label:"Primary Database",   sub:supabaseConfigured ? "Supabase cloud database" : "Browser localStorage",      action:null},
              {icon:HardDrive,label:"USB Backup (Manual)",sub:"Download full JSON to save on USB drives",  action:"USB"},
              {icon:Cloud,    label:"Cloud Snapshot",     sub:"Download JSON for offsite cloud storage",   action:"Cloud"},
            ].map(b => {
              const Icon = b.icon;
              return (
                <div key={b.label} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                  <Icon className="w-8 h-8 text-primary flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-foreground text-sm">{b.label}</p>
                    <p className="text-xs text-muted-foreground">{b.sub}</p>
                    {backupMsg === b.action && (
                      <p className="text-xs text-green-400 font-bold flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3"/> Downloaded</p>
                    )}
                  </div>
                  {b.action ? (
                    <button onClick={() => handleBackup(b.action!)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-tighter flex-shrink-0 hover:brightness-110 active:scale-95 transition-all">
                      <Download className="w-3 h-3"/> Download
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-green-400 font-black flex-shrink-0"><CheckCircle2 className="w-3 h-3"/> Active</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Danger Zone ── */}
        {user?.role === "Partner" && (
          <div className="bg-card border border-red-700/40 rounded-2xl p-5">
            <h2 className="font-black uppercase tracking-widest text-xs text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4"/> Danger Zone
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently wipe all tools, ledger entries, bills, customers, service jobs,
              and worker records. User accounts and shop settings are kept.
            </p>
            <button onClick={() => setConfirmReset(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-900/40 border border-red-700/40 text-red-400 text-sm font-black uppercase tracking-tighter hover:bg-red-900/60 transition-all">
              <Trash2 className="w-4 h-4"/> Wipe All Data
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
