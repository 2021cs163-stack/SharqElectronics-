import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseConfigError } from '@/lib/supabase';
import { cloudStatus, downloadCloudBackup, flushCloudData, importLocalData, isCloudEmpty, loadCloudData } from '@/lib/app-storage';

const CloudUser = createContext<User | null>(null);
export const useCloudUser = () => useContext(CloudUser);

export function CloudGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [empty, setEmpty] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sync, setSync] = useState(cloudStatus.get);
  useEffect(() => cloudStatus.subscribe(() => setSync(cloudStatus.get())), []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let currentId: string | undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      if (currentId && currentId !== next?.id) { window.location.reload(); return; }
      // Token refresh should not remount providers or discard unsaved changes.
      if (currentId && currentId === next?.id) return;
      currentId = next?.id;
      setUser(next); setLoaded(false); setLoading(Boolean(next));
      if (!next) return;
      void loadCloudData(next.id).then(() => {
        if (!active) return;
        setEmpty(isCloudEmpty()); setLoaded(true); setLoading(false);
      }).catch(failure => {
        if (active) { setError(failure.message); setLoading(false); }
      });
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (supabase && cloudStatus.get().status !== 'saved') { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  if (supabaseConfigError) return <main className="p-8" role="alert">{supabaseConfigError}</main>;
  if (!supabase) return <>{children}</>;
  const button = 'rounded-lg bg-primary px-4 py-3 text-white disabled:opacity-50';
  if (!loaded || empty) return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
    <section className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8">
      <h1 className="text-2xl font-bold">ShopShield · Supabase</h1>
      {loading ? <p>Loading your shop…</p> : !user ? <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); setError(''); setLoading(true);
        const { error } = await supabase!.auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); setLoading(false); }
      }}>
        <p>Sign in with your Supabase email and password.</p>
        <label className="block">Email<input className="mt-1 w-full rounded-lg bg-background border p-3" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block">Password<input className="mt-1 w-full rounded-lg bg-background border p-3" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className={button}>Sign in</button>
        <p className="text-sm text-muted-foreground">Create your account in Supabase → Authentication → Users first.</p>
      </form> : empty ? <>
        <p>Your cloud shop is empty. Import business records from this browser, or start with the app’s default inventory. Local PIN accounts are not imported.</p>
        <button className={button} onClick={async () => {
          setLoading(true);
          try { await importLocalData(); setEmpty(false); }
          catch (failure) { setError((failure as Error).message); }
          finally { setLoading(false); }
        }}>Import this browser’s data</button>
        <button className="block underline" onClick={() => setEmpty(false)}>Start fresh</button>
      </> : <button className={button} onClick={() => window.location.reload()}>Retry loading</button>}
      {error && <p role="alert" className="text-red-500">{error}</p>}
      {user && <button className="block underline" onClick={() => void supabase!.auth.signOut()}>Sign out</button>}
    </section>
  </main>;
  return <CloudUser.Provider value={user}>
    <div className="bg-card border-b px-4 py-2 text-sm flex items-center gap-4" role="status">
      <span>{sync.status === 'saved' ? 'Saved to Supabase' : sync.status === 'saving' ? 'Saving to Supabase…' : 'Cloud save failed'}</span>
      <button className="underline" onClick={downloadCloudBackup}>Export backup</button>
    </div>
    {children}
    {sync.status === 'error' && <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-6">
      <section className="bg-card text-foreground p-8 rounded-xl max-w-lg space-y-4">
        <h2 className="font-bold text-xl">Your changes have not been saved</h2>
        <p>{sync.error}</p><p>Export a backup before reloading. Reloading loads the latest cloud records and discards unsaved changes.</p>
        <button className={button} onClick={downloadCloudBackup}>Export unsaved changes</button>
        <button className="block underline" onClick={() => window.location.reload()}>Reload cloud data</button>
      </section>
    </div>}
  </CloudUser.Provider>;
}

export async function cloudLogout() {
  try {
    await flushCloudData();
    const { error } = await supabase!.auth.signOut();
    if (error) throw error;
  } catch (failure) { window.alert(`Could not sign out: ${(failure as Error).message}`); }
}
