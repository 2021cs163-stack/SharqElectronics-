import { supabase } from './supabase';

export const DATA_KEYS = [
  'shopshield_tools', 'shopshield_ledger', 'shopshield_day_state',
  'shopshield_bills', 'shopshield_customers', 'shopshield_service_jobs',
  'shopshield_service_workers', 'shopshield_worker_txns', 'shopshield_projects',
  'shopshield_rentals', 'shopshield_activity_log', 'shopshield_shop_settings',
  'sharq_expenses', 'sharq_shopping', 'sharq_partner_txns',
  'shopshield_txs', 'shopshield_transactions',
] as const;
type Snapshot = Record<string, string>;
type Status = 'saved' | 'saving' | 'error';
let snapshot: Snapshot = {};
let version = 0;
let generation = 0;
let owner = '';
let ready = false;
let status: Status = 'saved';
let error = '';
let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
function announce(next: Status, message = '') {
  status = next; error = message;
  listeners.forEach(listener => listener());
}
export const cloudStatus = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => ({ status, error }),
};
export async function loadCloudData(userId: string) {
  if (!supabase) return;
  ready = false;
  const { data, error } = await supabase.from('shop_state').select('data, version').eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  snapshot = data?.data ?? {};
  version = data?.version ?? 0;
  owner = userId;
  generation = 0;
  ready = true;
  announce('saved');
}
export async function flushCloudData(): Promise<void> {
  if (!supabase || !ready || status === 'saved') return;
  if (running) { await running; return flushCloudData(); }
  if (status === 'error') throw new Error(error);
  const sentGeneration = generation;
  const sent = { ...snapshot };
  running = (async () => {
    const { data, error: failure } = await supabase!.rpc('save_shop_state', {
      expected_version: version, next_data: sent,
    });
    if (failure) throw failure;
    version = Number(data);
    if (generation === sentGeneration) announce('saved');
  })();
  try { await running; }
  catch (failure) {
    announce('error', failure instanceof Error ? failure.message : String((failure as { message?: string }).message || failure));
    throw failure;
  } finally { running = null; }
  if (status === 'saving') await flushCloudData();
}
function changed() {
  generation++;
  if (status === 'error') return;
  announce('saving');
  clearTimeout(timer);
  timer = setTimeout(() => { void flushCloudData().catch(() => {}); }, 250);
}
export function downloadCloudBackup() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ owner, version, data: snapshot }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'shopshield-cloud-backup.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function importLocalData() {
  if (Object.keys(snapshot).length) throw new Error('Import is only available for an empty cloud shop.');
  for (const key of DATA_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) snapshot[key] = value;
  }
  changed();
  await flushCloudData();
}
export const appStorage = {
  getItem(key: string): string | null {
    if (!supabase) return localStorage.getItem(key);
    if (!ready) throw new Error('Cloud data has not loaded.');
    return snapshot[key] ?? null;
  },
  setItem(key: string, value: string) {
    if (!supabase) { localStorage.setItem(key, value); return; }
    if (!ready) throw new Error('Cloud data has not loaded.');
    if (!(DATA_KEYS as readonly string[]).includes(key)) throw new Error(`Unsupported data key: ${key}`);
    if (snapshot[key] !== value) { snapshot[key] = value; changed(); }
  },
  removeItem(key: string) {
    if (!supabase) { localStorage.removeItem(key); return; }
    if (!ready) throw new Error('Cloud data has not loaded.');
    if (key in snapshot) { delete snapshot[key]; changed(); }
  },
};
export const isCloudEmpty = () => Object.keys(snapshot).length === 0;
