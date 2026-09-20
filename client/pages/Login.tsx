import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, User, verifyTotp, generateTotpSecret } from "@/hooks/use-auth";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { useScanner } from "@/hooks/use-scanner";
import {
  Delete, Zap, Plus, Eye, EyeOff, Smartphone,
  QrCode, ShieldCheck, Key, Barcode
} from "lucide-react";

// Generate TOTP QR code URL (otpauth:// URI → Google Authenticator compatible)
function totpUri(secret: string, name: string, issuer: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(name)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// Tiny inline QR renderer using the qrcode library loaded via CDN
async function renderQR(text: string, canvas: HTMLCanvasElement) {
  // Dynamically import qrcode to keep bundle lean
  const QRCode = (await import('qrcode')).default;
  await QRCode.toCanvas(canvas, text, { width: 220, margin: 2, color: { dark: '#000', light: '#fff' } });
}

type LoginView = 'pick' | 'pin' | 'totp' | 'scan_barcode' | 'bootstrap';

export default function Login() {
  const { user, users, login, addUser, generateTotpSecret: genSecret } = useAuth();
  const { settings } = useShopSettings();
  const navigate = useNavigate();

  const [view,       setView]       = useState<LoginView>('pick');
  const [selected,   setSelected]   = useState<User | null>(null);
  const [pin,        setPin]        = useState('');
  const [totpCode,   setTotpCode]   = useState('');
  const [error,      setError]      = useState('');
  const [shake,      setShake]      = useState(false);

  // Bootstrap state
  const [bsName,  setBsName]  = useState('');
  const [bsPin,   setBsPin]   = useState('');
  const [bsPin2,  setBsPin2]  = useState('');
  const [bsAuth,  setBsAuth]  = useState<'pin'|'totp'|'barcode'>('pin');
  const [bsSecret,setBsSecret]= useState('');
  const [bsErr,   setBsErr]   = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const [qrCanvas,setQrCanvas]= useState<HTMLCanvasElement|null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);

  const activeUsers = users.filter(u => u.active !== false);
  const isFirstRun  = activeUsers.length === 0;

  // When bootstrap TOTP is selected, generate secret and render QR
  useEffect(() => {
    if (bsAuth === 'totp' && !bsSecret) setBsSecret(genSecret());
  }, [bsAuth]);

  useEffect(() => {
    if (bsAuth === 'totp' && bsSecret && canvasRef.current) {
      const uri = totpUri(bsSecret, bsName || 'User', settings.shopName || 'Sharq Electronics');
      renderQR(uri, canvasRef.current);
    }
  }, [bsAuth, bsSecret, bsName, canvasRef.current]);

  // USB barcode scanner listener — works on pick screen AND scan_barcode screen
  useScanner({
    enabled: !user && (view === 'pick' || view === 'scan_barcode'),
    onScan: (code) => {
      const ok = login(code);
      if (ok) navigate('/');
      else {
        setError('Card not recognised — try PIN');
        setTimeout(() => setError(''), 2500);
      }
    },
  });

  const triggerError = (msg = 'Wrong credential — try again') => {
    setError(msg); setShake(true);
    setTimeout(() => { setShake(false); setError(''); }, 2000);
  };

  // PIN login
  const handleDigit = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next); setError('');
    if (next.length === 4 || next.length === 6) {
      const ok = login(next);
      if (ok) navigate('/');
      else if (next.length === 6) { setPin(''); triggerError(); }
    }
  };
  const handlePinSubmit = () => { if (pin.length >= 4 && login(pin)) navigate('/'); else triggerError(); };

  const handleTotp = async () => {
    if (!selected?.totpSecret || totpCode.length < 6) return;
    const ok = await verifyTotp(selected.totpSecret, totpCode);
    if (ok) {
      // Log in with PIN as the credential — TOTP verified, PIN is the identity token
      // This works because verifyTotp confirmed identity; login(pin) sets the user object
      const loggedIn = login(selected.pin);
      if (loggedIn) navigate('/');
      else { setTotpCode(''); triggerError('TOTP ok but login failed — contact admin'); }
    } else {
      setTotpCode('');
      triggerError('Wrong code — try again');
    }
  };

  // Detect if accessed from a network device (not the shop PC itself)
  const isNetworkClient = typeof window !== 'undefined' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname);

  // Bootstrap: create first account
  const createFirst = async () => {
    setBsErr('');
    if (!bsName.trim()) { setBsErr('Name required'); return; }
    if (bsAuth === 'pin') {
      if (bsPin.length < 4) { setBsErr('PIN must be 4+ digits'); return; }
      if (bsPin !== bsPin2) { setBsErr("PINs don't match"); return; }
    }
    const r = addUser({
      name: bsName, role: 'Partner', pin: bsPin || 'changeme',
      authMethod: bsAuth,
      totpSecret: bsAuth === 'totp' ? bsSecret : undefined,
    }, '');
    if (r.ok) { login(bsPin || ''); navigate('/'); }
    else setBsErr(r.err || 'Failed');
  };

  const roleColor: Record<string, string> = {
    Partner: 'bg-primary/20 text-primary border-primary/30',
    Staff:   'bg-blue-900/30 text-blue-400 border-blue-700/30',
    Tech:    'bg-purple-900/30 text-purple-400 border-purple-700/30',
  };
  const pad = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/8 rounded-full blur-3xl"/>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/4 rounded-full blur-3xl"/>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-xl shadow-primary/30 mb-4">
            <Zap className="w-8 h-8 text-white"/>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">
            {settings.shopName || 'Sharq Electronics'}
          </h1>
          {settings.shopTagline && (
            <p className="text-muted-foreground text-xs mt-1 font-bold uppercase tracking-widest">
              {settings.shopTagline}
            </p>
          )}
        </div>

        {/* ── FIRST RUN: create admin ── */}
        {isFirstRun && isNetworkClient && (
          <div className="mt-4 p-4 rounded-2xl bg-yellow-900/20 border border-yellow-700/30 text-center">
            <p className="text-yellow-400 font-black text-sm uppercase tracking-widest mb-2">Network Device</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              You are accessing Sharq Electronics from a mobile or remote device.<br/>
              All data and accounts live on the <strong className="text-foreground">shop PC</strong>.<br/>
              Open this app on the shop PC first and sign in there.<br/>
              Then reload this page — your accounts will appear.
            </p>
            <p className="text-[10px] text-muted-foreground mt-3">
              Shop PC address: <span className="text-primary font-mono">http://{window.location.hostname}:8080</span>
            </p>
          </div>
        )}
        {isFirstRun && view !== 'bootstrap' && !isNetworkClient && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">No accounts yet.</p>
            <button onClick={() => setView('bootstrap')}
              className="w-full h-12 rounded-2xl bg-primary text-white font-black uppercase text-sm hover:brightness-110 flex items-center justify-center gap-2">
              <Plus className="w-5 h-5"/> Create Admin Account
            </button>
          </div>
        )}

        {/* ── BOOTSTRAP ── */}
        {view === 'bootstrap' && (
          <div className="space-y-3">
            <p className="text-center text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">
              Create First Account
            </p>
            <input placeholder="Your name *" value={bsName} onChange={e=>setBsName(e.target.value)}
              className="w-full h-12 px-4 bg-card border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>

            {/* Auth method picker */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { id:'pin',     icon:Key,         label:'PIN'     },
                { id:'totp',    icon:Smartphone,  label:'App Code'},
                { id:'barcode', icon:Barcode,      label:'Barcode' },
              ] as const).map(m => {
                const Icon = m.icon;
                return (
                  <button key={m.id} onClick={()=>setBsAuth(m.id)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-black uppercase transition-all ${
                      bsAuth===m.id?'bg-primary border-primary text-white':'border-border text-muted-foreground hover:border-primary/40'
                    }`}>
                    <Icon className="w-4 h-4"/>{m.label}
                  </button>
                );
              })}
            </div>

            {/* PIN setup */}
            {bsAuth === 'pin' && (
              <>
                <div className="relative">
                  <input placeholder="PIN (4-6 digits) *" type={showPw?'text':'password'}
                    value={bsPin} onChange={e=>setBsPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                    className="w-full h-12 px-4 pr-12 bg-card border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                  <button onClick={()=>setShowPw(v=>!v)} className="absolute right-3 top-3 text-muted-foreground">
                    {showPw?<EyeOff className="w-5 h-5"/>:<Eye className="w-5 h-5"/>}
                  </button>
                </div>
                <input placeholder="Confirm PIN *" type="password"
                  value={bsPin2} onChange={e=>setBsPin2(e.target.value.replace(/\D/g,'').slice(0,6))}
                  className="w-full h-12 px-4 bg-card border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </>
            )}

            {/* TOTP setup */}
            {bsAuth === 'totp' && (
              <div className="space-y-3">
                <div className="bg-card border border-border rounded-2xl p-4 text-center space-y-3">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Scan with Google Authenticator / Aegis
                  </p>
                  <div className="flex justify-center">
                    <canvas ref={canvasRef} className="rounded-xl"/>
                  </div>
                  <p className="text-[10px] text-muted-foreground break-all font-mono">{bsSecret}</p>
                  <p className="text-[10px] text-yellow-400">Scan the QR code with your authenticator app before continuing</p>
                </div>
                {/* Still need PIN as backup */}
                <div className="relative">
                  <input placeholder="Backup PIN (4+ digits) *" type={showPw?'text':'password'}
                    value={bsPin} onChange={e=>setBsPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                    className="w-full h-12 px-4 pr-12 bg-card border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                  <button onClick={()=>setShowPw(v=>!v)} className="absolute right-3 top-3 text-muted-foreground">
                    {showPw?<EyeOff className="w-5 h-5"/>:<Eye className="w-5 h-5"/>}
                  </button>
                </div>
              </div>
            )}

            {/* Barcode setup */}
            {bsAuth === 'barcode' && (
              <div className="space-y-3">
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center space-y-2">
                  <Barcode className="w-8 h-8 text-primary mx-auto"/>
                  <p className="text-xs text-muted-foreground">
                    Scan any barcode card / ID card now to register it as your login card.
                    Or you can skip and add it later from User Access.
                  </p>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-1">
                    Waiting for scan…
                  </p>
                </div>
                <input placeholder="Backup PIN (4+ digits) *" type={showPw?'text':'password'}
                  value={bsPin} onChange={e=>setBsPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                  className="w-full h-12 px-4 pr-12 bg-card border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
            )}

            {bsErr && <p className="text-red-400 text-xs font-bold text-center">{bsErr}</p>}
            <button onClick={createFirst} disabled={!bsName||(bsAuth==='pin'&&bsPin.length<4)}
              className="w-full h-12 rounded-2xl bg-primary text-white font-black uppercase text-sm hover:brightness-110 disabled:opacity-40">
              Create & Sign In
            </button>
            <p className="text-[10px] text-muted-foreground text-center">This creates a Partner (admin) account</p>
          </div>
        )}

        {/* ── USER PICK ── */}
        {!isFirstRun && view === 'pick' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Account</p>
              <button onClick={() => setView('scan_barcode')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted-foreground text-xs font-black hover:border-primary/40 hover:text-primary transition-all">
                <Barcode className="w-3.5 h-3.5"/> Scan Card
              </button>
            </div>
            {activeUsers.map(u => (
              <button key={u.id} onClick={() => {
                setSelected(u); setPin(''); setError('');
                setView(u.authMethod === 'totp' ? 'totp' : 'pin');
              }}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-black text-foreground text-sm">{u.name}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {u.authMethod === 'totp'    && <Smartphone className="w-4 h-4 text-muted-foreground"/>}
                  {u.authMethod === 'barcode' && <Barcode    className="w-4 h-4 text-muted-foreground"/>}
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${roleColor[u.role]??''}`}>
                    {u.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── SCAN BARCODE SCREEN ── */}
        {view === 'scan_barcode' && (
          <div className="space-y-5 text-center">
            <div className="bg-card border-2 border-dashed border-primary/40 rounded-2xl p-8 space-y-4">
              <Barcode className="w-12 h-12 text-primary mx-auto animate-pulse"/>
              <p className="font-black text-foreground text-lg uppercase tracking-tight">Waiting for scan</p>
              <p className="text-sm text-muted-foreground">Hold your card/badge in front of the barcode scanner</p>
              {error && <p className="text-red-400 text-sm font-bold">{error}</p>}
            </div>
            <button onClick={() => setView('pick')} className="text-muted-foreground text-xs font-black uppercase hover:text-white">
              ← Back to accounts
            </button>
          </div>
        )}

        {/* ── PIN PAD ── */}
        {view === 'pin' && selected && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => { setView('pick'); setSelected(null); setPin(''); setError(''); }}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-white font-black flex-shrink-0">←</button>
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg flex-shrink-0">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-foreground text-sm truncate">{selected.name}</p>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${roleColor[selected.role]??''}`}>{selected.role}</span>
              </div>
            </div>
            <div className={`mb-5 ${shake?'animate-bounce':''}`}>
              <div className="flex justify-center gap-3 mb-2">
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${i<pin.length?'bg-primary border-primary scale-125':'border-border'}`}/>
                ))}
              </div>
              <p className={`text-center text-xs font-bold mt-2 ${error?'text-red-400':'text-muted-foreground'}`}>
                {error || 'Enter PIN'}
              </p>
            </div>
            <div className="bg-card border border-border rounded-3xl p-5 shadow-xl">
              <div className="grid grid-cols-3 gap-3">
                {pad.map((k,i) => (
                  k===''?<div key={i}/>:
                  k==='⌫'?(
                    <button key={i} onClick={()=>{setPin(p=>p.slice(0,-1));setError('');}}
                      className="h-14 rounded-2xl bg-muted/50 hover:bg-muted transition-all active:scale-95 flex items-center justify-center">
                      <Delete className="w-5 h-5 text-foreground"/>
                    </button>
                  ):(
                    <button key={i} onClick={()=>handleDigit(k)}
                      className="h-14 rounded-2xl bg-secondary hover:bg-primary hover:text-white text-foreground font-black text-xl transition-all active:scale-95 border border-border hover:border-primary hover:shadow-lg hover:shadow-primary/20">
                      {k}
                    </button>
                  )
                ))}
              </div>
              <button onClick={handlePinSubmit} disabled={pin.length<4}
                className="mt-3 w-full h-14 rounded-2xl bg-primary hover:brightness-110 text-white font-black uppercase tracking-widest text-sm active:scale-95 shadow-xl shadow-primary/30 disabled:opacity-40">
                Sign In
              </button>
            </div>
            {selected.totpSecret && (
              <button onClick={() => setView('totp')} className="w-full mt-3 text-muted-foreground text-xs font-black uppercase hover:text-primary">
                <Smartphone className="w-3.5 h-3.5 inline mr-1.5"/>Use Authenticator App Instead
              </button>
            )}
          </>
        )}

        {/* ── TOTP ── */}
        {view === 'totp' && selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => { setView('pick'); setSelected(null); setTotpCode(''); setError(''); }}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-white font-black flex-shrink-0">←</button>
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg flex-shrink-0">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-foreground text-sm truncate">{selected.name}</p>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${roleColor[selected.role]??''}`}>{selected.role}</span>
              </div>
            </div>
            <div className={`space-y-4 ${shake?'animate-bounce':''}`}>
              <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-3">
                <Smartphone className="w-8 h-8 text-primary mx-auto"/>
                <p className="text-sm text-muted-foreground">Open Google Authenticator / Aegis and enter the 6-digit code</p>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  autoFocus
                  className="w-full h-16 bg-background border border-border rounded-xl text-center text-3xl font-black text-primary tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {error && <p className="text-red-400 text-sm font-bold">{error}</p>}
              </div>
              <button onClick={handleTotp} disabled={totpCode.length < 6}
                className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm hover:brightness-110 disabled:opacity-40">
                <ShieldCheck className="w-5 h-5 inline mr-2"/>Verify Code
              </button>
            </div>
            {selected.pin && (
              <button onClick={() => setView('pin')} className="w-full text-muted-foreground text-xs font-black uppercase hover:text-primary">
                <Key className="w-3.5 h-3.5 inline mr-1.5"/>Use PIN Instead
              </button>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
            <span className="text-xs text-muted-foreground font-bold">Offline · Local</span>
          </div>
        </div>
      </div>
    </div>
  );
}
