import { supabaseConfigured } from '@/lib/supabase';
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Users, Plus, X, UserX, UserCheck, Shield, Wrench, HardHat, ChevronDown, ChevronUp, Key, Smartphone, QrCode } from "lucide-react";
import { useRef } from "react";
import { generateTotpSecret, verifyTotp } from "@/hooks/use-auth";

export default function UserAccess() {
  if (supabaseConfigured) return <Layout><section className="p-8 space-y-4"><h1 className="text-2xl font-bold">Cloud account access</h1><p>Each Supabase account owns a separate shop. Manage email and password accounts in your Supabase dashboard under Authentication → Users.</p><p>Shared shops with Staff and Tech permissions are not enabled in cloud mode. Local PIN accounts are available in offline mode.</p></section></Layout>;
  return <LocalUserAccess />;
}

function LocalUserAccess() {
  const { user, users, addUser, deactivate, reactivate, updateUser } = useAuth();

  const [showAdd,      setShowAdd]      = useState(false);
  const [name,         setName]         = useState("");
  const [pin,          setPin]          = useState("");
  const [confirmPin,   setConfirmPin]   = useState("");
  const [role,         setRole]         = useState<"Partner" | "Staff" | "Tech">("Staff");
  const [authPin,      setAuthPin]      = useState("");
  const [err,          setErr]          = useState("");
  const [ok,           setOk]           = useState("");
  const [showRoles,    setShowRoles]    = useState(false);

  const inp = "w-full bg-background border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors";
  const lbl = "block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5";

  const activeUsers   = users.filter(u => u.active !== false);
  const inactiveUsers = users.filter(u => u.active === false);

  const isPartner = user?.role === "Partner";

  const rolePill = (r: string) => {
    const base = "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full";
    if (r === "Partner") return `${base} bg-primary/20 text-primary`;
    if (r === "Tech")    return `${base} bg-blue-500/20 text-blue-400`;
    return `${base} bg-muted text-muted-foreground`;
  };

  const roleIcon = (r: string) => {
    if (r === "Partner") return <Shield className="w-4 h-4 text-primary" />;
    if (r === "Tech")    return <Wrench className="w-4 h-4 text-blue-400" />;
    return <HardHat className="w-4 h-4 text-muted-foreground" />;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (pin !== confirmPin) return setErr("PINs do not match.");
    const res = addUser({ name, role, pin }, authPin);
    if (res.ok) {
      setOk("User created successfully.");
      setTimeout(() => {
        setShowAdd(false); setOk("");
        setName(""); setPin(""); setConfirmPin(""); setAuthPin("");
      }, 1400);
    } else {
      setErr(res.err ?? "Failed to create user.");
    }
  };

  // ── My Security settings ──────────────────────────────────────
  const [showMyTotp, setShowMyTotp]   = useState(false);
  const [myTotpSecret, setMyTotpSecret] = useState('');
  const [myTotpVerify, setMyTotpVerify] = useState('');
  const [myTotpOk,     setMyTotpOk]     = useState(false);
  const [myTotpErr,    setMyTotpErr]     = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const startTotpSetup = () => {
    const secret = generateTotpSecret();
    setMyTotpSecret(secret);
    setMyTotpVerify(''); setMyTotpOk(false); setMyTotpErr('');
    setShowMyTotp(true);
    // Render QR after mount
    setTimeout(async () => {
      if (qrCanvasRef.current && secret) {
        const uri = `otpauth://totp/${encodeURIComponent(user?.name||'User')}?secret=${secret}&issuer=SharqElectronics&algorithm=SHA1&digits=6&period=30`;
        const QRCode = (await import('qrcode')).default;
        await QRCode.toCanvas(qrCanvasRef.current, uri, { width: 200, margin: 2, color:{dark:'#000',light:'#fff'} });
      }
    }, 50);
  };

  const confirmTotpSetup = async () => {
    if (!user) return;
    const ok = await verifyTotp(myTotpSecret, myTotpVerify);
    if (ok) {
      updateUser(user.id, { totpSecret: myTotpSecret, authMethod: 'totp' });
      setMyTotpOk(true); setMyTotpErr('');
      setTimeout(() => setShowMyTotp(false), 2000);
    } else {
      setMyTotpErr('Wrong code — try again with a fresh code from the app');
    }
  };

  const removeTotpSetup = () => {
    if (!user) return;
    updateUser(user.id, { totpSecret: undefined, authMethod: 'pin' });
  };

  return (
    <Layout>
      {/* ── My Security ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">My Account Security</p>
            <p className="text-sm font-bold text-foreground mt-0.5">{user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.totpSecret ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-black text-green-400 bg-green-900/20 border border-green-700/30 px-3 py-1.5 rounded-xl">
                  <Smartphone className="w-3.5 h-3.5"/> Authenticator Active
                </span>
                <button onClick={removeTotpSetup} className="text-[10px] font-black uppercase text-muted-foreground hover:text-red-400 px-2 py-1.5">Remove</button>
              </div>
            ) : (
              <button onClick={startTotpSetup}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-black uppercase hover:bg-primary/20">
                <QrCode className="w-4 h-4"/> Add Authenticator App
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TOTP Setup Modal */}
      {showMyTotp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-black uppercase tracking-tighter text-white">Set Up Authenticator</h3>
              <button onClick={() => setShowMyTotp(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            {myTotpOk ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-8 h-8 text-green-400"/>
                </div>
                <p className="font-black text-green-400 text-lg">Authenticator Enabled!</p>
                <p className="text-xs text-muted-foreground mt-2">From now on you can log in using your 6-digit code</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-sm text-muted-foreground">1. Open <strong className="text-foreground">Google Authenticator</strong> or <strong className="text-foreground">Aegis</strong> on your phone</p>
                <p className="text-sm text-muted-foreground">2. Tap + and scan this QR code:</p>
                <div className="flex justify-center bg-white p-3 rounded-2xl">
                  <canvas ref={qrCanvasRef} className="rounded-xl"/>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Manual Entry Key</p>
                  <p className="font-mono text-xs text-foreground break-all">{myTotpSecret}</p>
                </div>
                <p className="text-sm text-muted-foreground">3. Enter the 6-digit code from the app to verify:</p>
                <input type="text" inputMode="numeric" maxLength={6} placeholder="000000"
                  value={myTotpVerify} onChange={e=>setMyTotpVerify(e.target.value.replace(/\D/g,'').slice(0,6))}
                  className="w-full h-14 bg-input border border-border text-foreground rounded-xl text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary"/>
                {myTotpErr && <p className="text-xs text-red-400 font-bold text-center">{myTotpErr}</p>}
                <button onClick={confirmTotpSetup} disabled={myTotpVerify.length < 6}
                  className="w-full py-3 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110 disabled:opacity-40">
                  Verify & Enable
                </button>
                <p className="text-[10px] text-muted-foreground text-center">Your PIN still works as backup</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add user modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-black text-lg uppercase tracking-tighter text-foreground">Add User</h3>
              <button onClick={() => { setShowAdd(false); setErr(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className={lbl}>Full Name</label>
                <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" required />
              </div>
              <div>
                <label className={lbl}>Role</label>
                <div className="flex gap-2">
                  {(["Staff", "Tech", "Partner"] as const).map(r => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${
                        role === r ? "bg-primary border-primary text-white" : "border-border text-muted-foreground hover:border-primary/50"
                      }`}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>PIN (min 4 digits)</label>
                <input className={inp} type="password" inputMode="numeric"
                  value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,"").slice(0,8))}
                  placeholder="••••" required />
              </div>
              <div>
                <label className={lbl}>Confirm PIN</label>
                <input className={inp} type="password" inputMode="numeric"
                  value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,"").slice(0,8))}
                  placeholder="••••" required />
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-primary font-black text-[10px] uppercase tracking-widest mb-1">Partner Authorization</p>
                <p className="text-muted-foreground text-xs mb-3">Enter your Partner PIN to authorize this new account.</p>
                <input className={inp} type="password" inputMode="numeric"
                  value={authPin} onChange={e => setAuthPin(e.target.value.replace(/\D/g,"").slice(0,8))}
                  placeholder="Your Partner PIN" required />
              </div>
              {err && <p className="text-red-400 text-xs font-bold bg-red-900/20 border border-red-700/30 rounded-xl px-4 py-2">{err}</p>}
              {ok  && <p className="text-green-400 text-xs font-bold bg-green-900/20 border border-green-700/30 rounded-xl px-4 py-2">{ok}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAdd(false); setErr(""); }}
                  className="flex-1 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground font-black uppercase tracking-widest text-xs transition-all">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-[2] py-3 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-xs hover:brightness-110 shadow-lg shadow-primary/20 transition-all">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground flex items-center gap-3">
              <Users className="w-7 h-7 text-primary" /> User Access
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {activeUsers.length} active account{activeUsers.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isPartner && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-black uppercase tracking-tighter text-xs shadow-lg shadow-primary/20 hover:brightness-110 transition-all">
              <Plus className="w-4 h-4" /> Add User
            </button>
          )}
        </div>

        {/* Active users */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Accounts</p>
          </div>
          <div className="divide-y divide-border">
            {activeUsers.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0 font-black text-foreground">
                  {u.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-foreground font-black text-sm">{u.name}</p>
                    <span className={rolePill(u.role)}>{u.role}</span>
                    {u.id === user?.id && <span className="text-[10px] text-primary font-black">(you)</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {u.email}
                    {u.joinDate && <span className="ml-2 opacity-60">· Joined {u.joinDate}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {roleIcon(u.role)}
                  {isPartner && u.id !== user?.id && (
                    <button onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivate(u.id); }}
                      className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-900/20 transition-all"
                      title="Deactivate">
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inactive users */}
        {inactiveUsers.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden opacity-60">
            <div className="px-5 py-3 border-b border-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Deactivated</p>
            </div>
            <div className="divide-y divide-border">
              {inactiveUsers.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center flex-shrink-0 font-black text-muted-foreground text-xs">
                    {u.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-muted-foreground font-bold text-sm line-through">{u.name}</p>
                    <p className="text-xs text-muted-foreground/60">{u.role}</p>
                  </div>
                  {isPartner && (
                    <button onClick={() => reactivate(u.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-green-400 hover:bg-green-900/20 transition-all"
                      title="Reactivate">
                      <UserCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role reference */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button onClick={() => setShowRoles(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-primary/[0.02] transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Key className="w-3.5 h-3.5" /> Role Reference & Demo PINs
            </p>
            {showRoles ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showRoles && (
            <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
              {[
                { role:"Partner", pin:"1234", color:"border-primary/30 bg-primary/5", icon:<Shield className="w-4 h-4 text-primary"/>,
                  can:["Full system access","Approve pending entries","Close the day","Corrective adjustments","Manage users","Reset data"],
                  cannot:["Nothing — full access"] },
                { role:"Staff",   pin:"2345", color:"border-blue-500/20 bg-blue-900/5", icon:<HardHat className="w-4 h-4 text-blue-400"/>,
                  can:["Check out tools","Return tools","Log & complete repairs","Print asset tags","View inventory & ledger"],
                  cannot:["Approve entries","Close day","Corrective adjustments","User management"] },
                { role:"Tech",    pin:"3456", color:"border-green-500/20 bg-green-900/5", icon:<Wrench className="w-4 h-4 text-green-400"/>,
                  can:["View inventory & ledger","Log tools for repair","Mark repairs complete","Print asset tags"],
                  cannot:["Check out / return tools","Approve entries","Close day","User management"] },
              ].map(r => (
                <div key={r.role} className={`border rounded-xl p-4 ${r.color}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">{r.icon}<p className="text-foreground font-black text-sm">{r.role}</p></div>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded-lg">Demo PIN: {r.pin}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-green-400 font-black uppercase tracking-widest mb-1.5 text-[10px]">Can do</p>
                      {r.can.map(c => <p key={c} className="text-muted-foreground mb-1">✓ {c}</p>)}
                    </div>
                    <div>
                      <p className="text-red-400 font-black uppercase tracking-widest mb-1.5 text-[10px]">Cannot</p>
                      {r.cannot.map(c => <p key={c} className="text-muted-foreground mb-1">✗ {c}</p>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
