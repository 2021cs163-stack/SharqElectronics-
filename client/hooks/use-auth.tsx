import { useCloudUser, cloudLogout } from '@/components/CloudGate';
import { supabaseConfigured } from '@/lib/supabase';
import React, { createContext, useContext, useState, useEffect } from 'react';

export type AuthMethod = 'pin' | 'totp' | 'barcode';

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Partner" | "Staff" | "Tech";
  pin: string;               // static PIN (always exists as fallback)
  authMethod: AuthMethod;    // which method is primary
  totpSecret?: string;       // base32 secret for TOTP (Google Authenticator)
  barcodeId?: string;        // barcode value for scanner login
  active?: boolean;
  joinDate?: string;
}

const DEFAULT_USERS: User[] = [];

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (credential: string) => boolean;      // works for PIN, TOTP, or barcode
  logout: () => void;
  addUser: (data: {
    name: string; role: User["role"]; pin: string;
    authMethod?: AuthMethod; totpSecret?: string; barcodeId?: string;
    email?: string;
  }, authPartnerPin: string) => { ok: boolean; err?: string };
  updateUser: (userId: string, updates: Partial<User>) => void;
  deactivate: (id: string) => void;
  reactivate: (id: string) => void;
  updatePin: (userId: string, oldPin: string, newPin: string) => { ok: boolean; err?: string };
  verifyTotp: (secret: string, token: string) => Promise<boolean>;
  generateTotpSecret: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── TOTP implementation (RFC 6238) — no external import needed ──────────────
// Pure browser crypto — works offline forever
function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; output.push((value >>> bits) & 0xFF); }
  }
  return new Uint8Array(output);
}

function generateTotpSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = new Uint8Array(20); crypto.getRandomValues(bytes);
  let result = '';
  let buffer = 0, bitsLeft = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;
    while (bitsLeft >= 5) { bitsLeft -= 5; result += alphabet[(buffer >> bitsLeft) & 31]; }
  }
  return result;
}

async function computeHotp(secret: string, counter: bigint): Promise<string> {
  const keyData = base32Decode(secret);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  const hi = Number(counter >> 32n) >>> 0;
  const lo = Number(counter & 0xFFFFFFFFn) >>> 0;
  view.setUint32(0, hi); view.setUint32(4, lo);
  const key = await crypto.subtle.importKey('raw', keyData.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, msg);
  const arr = new Uint8Array(sig);
  const offset = arr[19] & 0xf;
  const code = ((arr[offset] & 0x7f) << 24) | (arr[offset+1] << 16) | (arr[offset+2] << 8) | arr[offset+3];
  return String(code % 1000000).padStart(6, '0');
}

async function verifyTotp(secret: string, token: string): Promise<boolean> {
  const counter = BigInt(Math.floor(Date.now() / 30000));
  // Check current window ±1 (allows 30s clock drift)
  for (const offset of [-1n, 0n, 1n]) {
    const expected = await computeHotp(secret, counter + offset);
    if (expected === token.replace(/\s/g, '')) return true;
  }
  return false;
}

// Sync wrapper that works via cache (updates every 30s)
let totpCache: Map<string, {code: string; ts: number}> = new Map();
function getTotpCode(secret: string): string {
  const slot = Math.floor(Date.now() / 30000);
  const cached = totpCache.get(secret);
  if (cached && cached.ts === slot) return cached.code;
  // Kick off async update
  computeHotp(secret, BigInt(slot)).then(code => {
    totpCache.set(secret, { code, ts: slot });
  });
  return cached?.code ?? '';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cloudUser = useCloudUser();
  if (!supabaseConfigured) return <LocalAuthProvider>{children}</LocalAuthProvider>;
  const user: User | null = cloudUser ? {
    id: cloudUser.id, name: cloudUser.email?.split('@')[0] || 'Owner',
    email: cloudUser.email || '', role: 'Partner', pin: '', authMethod: 'pin', active: true,
  } : null;
  const unsupported = () => ({ ok: false, err: 'Manage cloud accounts in Supabase Authentication. Local PIN accounts are available only in offline mode.' });
  return <AuthContext.Provider value={{
    user, users: user ? [user] : [], login: () => false,
    logout: () => { void cloudLogout(); }, addUser: unsupported,
    updateUser: () => {}, deactivate: () => {}, reactivate: () => {},
    updatePin: unsupported, verifyTotp, generateTotpSecret,
  }}>{children}</AuthContext.Provider>;
}

function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('shopshield_users');
      if (saved) {
        const parsed: User[] = JSON.parse(saved);
        // Remove old demo accounts
        const cleaned = parsed.filter(u => u.id !== 'U001' && u.id !== 'U002');
        if (cleaned.length !== parsed.length) localStorage.setItem('shopshield_users', JSON.stringify(cleaned));
        if (cleaned.length > 0) return cleaned;
      }
    } catch {}
    return DEFAULT_USERS;
  });

  useEffect(() => { localStorage.setItem('shopshield_users', JSON.stringify(users)); }, [users]);

  // Auto-logout on tab close
  useEffect(() => {
    const handler = () => localStorage.removeItem('shopshield_session');
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const login = (credential: string): boolean => {
    const clean = credential.trim().replace(/\s/g, '');
    for (const u of users) {
      if (u.active === false) continue;
      // 1. Barcode match
      if (u.barcodeId && u.barcodeId === clean) { setUser(u); return true; }
      // 2. PIN match
      if (u.pin === clean) { setUser(u); return true; }
    }
    // 3. TOTP — check all users who have totpSecret (async checked externally)
    return false;
  };

  const logout = () => { setUser(null); localStorage.removeItem('shopshield_session'); };

  const addUser = (
    data: { name: string; role: User["role"]; pin: string; authMethod?: AuthMethod; totpSecret?: string; barcodeId?: string; email?: string },
    authPartnerPin: string
  ): { ok: boolean; err?: string } => {
    if (users.length > 0) {
      const partner = users.find(u => u.role === "Partner" && u.pin === authPartnerPin && u.active !== false);
      if (!partner) return { ok: false, err: "Invalid partner PIN." };
    }
    if (data.pin && data.pin.length < 4) return { ok: false, err: "PIN must be at least 4 digits." };
    if (!data.name.trim()) return { ok: false, err: "Name is required." };
    if (data.pin && users.find(u => u.pin === data.pin)) return { ok: false, err: "PIN already in use." };
    const newUser: User = {
      id: `U${Date.now()}`, name: data.name.trim(),
      email: data.email || `${data.name.toLowerCase().replace(/\s/g,'.')}@sharq.local`,
      role: data.role, pin: data.pin,
      authMethod: data.authMethod || 'pin',
      totpSecret: data.totpSecret,
      barcodeId: data.barcodeId,
      active: true, joinDate: new Date().toISOString().split('T')[0],
    };
    setUsers(prev => [...prev, newUser]);
    return { ok: true };
  };

  const updateUser = (userId: string, updates: Partial<User>) =>
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));

  const deactivate = (id: string) => setUsers(prev => prev.map(u => u.id === id ? { ...u, active: false } : u));
  const reactivate = (id: string) => setUsers(prev => prev.map(u => u.id === id ? { ...u, active: true } : u));

  const updatePin = (userId: string, oldPin: string, newPin: string) => {
    const u = users.find(x => x.id === userId);
    if (!u) return { ok: false, err: "User not found." };
    if (u.pin !== oldPin) return { ok: false, err: "Current PIN incorrect." };
    if (newPin.length < 4) return { ok: false, err: "New PIN must be 4+ digits." };
    setUsers(prev => prev.map(x => x.id === userId ? { ...x, pin: newPin } : x));
    return { ok: true };
  };


  return (
    <AuthContext.Provider value={{
      user, users, login, logout, addUser, updateUser,
      deactivate, reactivate, updatePin,
      verifyTotp: (s: string, t: string) => verifyTotp(s, t),
      generateTotpSecret,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}

// Export helpers for Login page
export { verifyTotp, generateTotpSecret };
