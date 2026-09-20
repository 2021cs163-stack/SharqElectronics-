import { appStorage } from '@/lib/app-storage';
import React, { createContext, useContext, useState, useEffect } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
export type ExpenseCategory =
  | 'rent' | 'electricity' | 'salary' | 'purchase' | 'transport'
  | 'maintenance' | 'supplies' | 'partner_withdrawal' | 'partner_credit'
  | 'partner_borrow' | 'staff_advance' | 'other';

export interface Expense {
  id: string;
  date: string;       // YYYY-MM-DD
  time: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: 'Af' | 'USD';
  amountAf: number;   // always in Afghani for reports
  paidBy?: string;    // user name
  paidById?: string;
  linkedUserId?: string;   // for partner_withdrawal / staff_advance
  linkedUserName?: string;
  receipt?: string;   // optional note/ref
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  estimatedCost?: number;
  urgency: 'normal' | 'urgent';
  addedBy: string;
  addedDate: string;
  bought: boolean;
  boughtDate?: string;
  notes?: string;
}

export interface PartnerTransaction {
  id: string;
  date: string;
  time: string;
  partnerId: string;
  partnerName: string;
  type: 'credit' | 'debit';   // credit = added to partner, debit = taken from shop
  amount: number;
  amountAf: number;
  description: string;
  category: 'withdrawal' | 'investment' | 'salary' | 'expense' | 'other';
}

interface FinancialsContextType {
  expenses: Expense[];
  shoppingList: ShoppingItem[];
  partnerTxns: PartnerTransaction[];
  addExpense: (e: Omit<Expense, 'id' | 'time'>) => void;
  deleteExpense: (id: string) => void;
  importExpensesFromExcel: (rows: Omit<Expense, 'id' | 'time'>[]) => void;
  addShoppingItem: (item: Omit<ShoppingItem, 'id' | 'addedDate'>) => void;
  markBought: (id: string) => void;
  deleteShoppingItem: (id: string) => void;
  addPartnerTxn: (txn: Omit<PartnerTransaction, 'id' | 'time'>) => void;
}

const FinancialsContext = createContext<FinancialsContextType | undefined>(undefined);

export function FinancialsProvider({ children }: { children: React.ReactNode }) {
  const load = <T,>(key: string, def: T): T => {
    try { const s = appStorage.getItem(key); return s ? JSON.parse(s) : def; }
    catch { return def; }
  };

  const [expenses,     setExpenses]     = useState<Expense[]>(() => load('sharq_expenses', []));
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => load('sharq_shopping', []));
  const [partnerTxns,  setPartnerTxns]  = useState<PartnerTransaction[]>(() => load('sharq_partner_txns', []));

  useEffect(() => { appStorage.setItem('sharq_expenses',     JSON.stringify(expenses));     }, [expenses]);
  useEffect(() => { appStorage.setItem('sharq_shopping',     JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { appStorage.setItem('sharq_partner_txns', JSON.stringify(partnerTxns)); }, [partnerTxns]);

  const addExpense = (e: Omit<Expense, 'id' | 'time'>) => {
    const now = new Date();
    setExpenses(prev => [{
      ...e, id: `EXP-${Date.now()}`,
      time: now.toTimeString().split(' ')[0],
    }, ...prev]);
  };

  const deleteExpense = (id: string) =>
    setExpenses(prev => prev.filter(e => e.id !== id));

  const importExpensesFromExcel = (rows: Omit<Expense, 'id' | 'time'>[]) => {
    const now = new Date().toTimeString().split(' ')[0];
    setExpenses(prev => [
      ...rows.map(r => ({ ...r, id: `EXP-IMP-${Date.now()}-${Math.random().toString(36).slice(2)}`, time: now })),
      ...prev,
    ]);
  };

  const addShoppingItem = (item: Omit<ShoppingItem, 'id' | 'addedDate'>) =>
    setShoppingList(prev => [{
      ...item, id: `SHO-${Date.now()}`,
      addedDate: new Date().toISOString().split('T')[0],
    }, ...prev]);

  const markBought = (id: string) =>
    setShoppingList(prev => prev.map(i => i.id === id
      ? { ...i, bought: true, boughtDate: new Date().toISOString().split('T')[0] }
      : i));

  const deleteShoppingItem = (id: string) =>
    setShoppingList(prev => prev.filter(i => i.id !== id));

  const addPartnerTxn = (txn: Omit<PartnerTransaction, 'id' | 'time'>) =>
    setPartnerTxns(prev => [{
      ...txn, id: `PTX-${Date.now()}`,
      time: new Date().toTimeString().split(' ')[0],
    }, ...prev]);

  return (
    <FinancialsContext.Provider value={{
      expenses, shoppingList, partnerTxns,
      addExpense, deleteExpense, importExpensesFromExcel,
      addShoppingItem, markBought, deleteShoppingItem,
      addPartnerTxn,
    }}>
      {children}
    </FinancialsContext.Provider>
  );
}

export function useFinancials() {
  const ctx = useContext(FinancialsContext);
  if (!ctx) throw new Error('useFinancials must be within FinancialsProvider');
  return ctx;
}

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  rent:                'Rent',
  electricity:         'Electricity',
  salary:              'Staff Salary',
  purchase:            'Stock Purchase',
  transport:           'Transport',
  maintenance:         'Maintenance',
  supplies:            'Shop Supplies',
  partner_withdrawal:  'Partner Withdrawal',
  partner_borrow:      'Partner Borrow (Personal)',  // partner takes goods/cash for personal use
  partner_credit:      'Partner Credit/Investment',
  staff_advance:       'Staff Advance',
  other:               'Other',
};
