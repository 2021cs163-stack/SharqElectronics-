import { appStorage } from '@/lib/app-storage';
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ShopSettings {
  shopName: string; shopTagline: string; shopAddress: string;
  shopCity: string; shopPhone: string; shopPhone2: string;
  shopEmail: string; shopTaxId: string; receiptFooter: string;
  currency: string; currencySymbol: string;
  activeCurrency: 'Af' | 'USD';
  usdRate: number;
  theme: 'dark' | 'blue' | 'green' | 'rose' | 'light';
}
const DEFAULT: ShopSettings = {
  shopName: 'Sharq Electronics', shopTagline: 'Quality Electronics & Accessories',
  shopAddress: 'Main Bazaar, Shop No. 12', shopCity: 'Kabul, Afghanistan',
  shopPhone: '+93 700 000 000', shopPhone2: '', shopEmail: '', shopTaxId: '',
  receiptFooter: 'Thank you for your business!\nPlease come again.',
  currency: 'Af', currencySymbol: '؋',
  activeCurrency: 'Af' as const,
  usdRate: 70,
  theme: 'dark' as const,
};
const Ctx = createContext<{ settings: ShopSettings; updateSettings: (s: Partial<ShopSettings>) => void } | undefined>(undefined);

export function ShopSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ShopSettings>(() => {
    try { const s = appStorage.getItem('shopshield_shop_settings'); return s ? { ...DEFAULT, ...JSON.parse(s) } : DEFAULT; }
    catch { return DEFAULT; }
  });
  useEffect(() => { appStorage.setItem('shopshield_shop_settings', JSON.stringify(settings)); }, [settings]);
  const updateSettings = (p: Partial<ShopSettings>) => setSettings(prev => ({ ...prev, ...p }));
  return <Ctx.Provider value={{ settings, updateSettings }}>{children}</Ctx.Provider>;
}
export function useShopSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useShopSettings must be within ShopSettingsProvider');
  return ctx;
}
