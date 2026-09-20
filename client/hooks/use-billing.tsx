import { appStorage } from '@/lib/app-storage';
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface BillItem {
  id: string; name: string; sku: string;
  qty: number; unitPrice: number; total: number;
}

export type BillStatus = 'paid' | 'credit'; // credit = borrowed / owe

export interface Bill {
  billNo:        string;
  date:          string;
  time:          string;
  customerName:  string;
  customerPhone: string;
  items:         BillItem[];
  subtotal:      number;
  discount:      number;
  grandTotal:    number;
  amountPaid:    number;   // how much was paid at time of sale
  balance:       number;   // grandTotal - amountPaid (positive = still owes)
  status:        BillStatus;
  createdBy:     string;
  printed:       boolean;
  paidDate?:     string;   // date fully settled
  notes?:        string;
}

export interface CustomerProfile {
  id:          string;
  name:        string;
  phone:       string;
  totalSpent:  number;
  visitCount:  number;
  lastVisit:   string;
  totalCredit: number;   // running total of what they currently owe
  notes?:      string;
}

interface BillingContextType {
  bills:          Bill[];
  customers:      CustomerProfile[];
  addBill:        (bill: Omit<Bill, 'billNo'|'date'|'time'>) => Bill;
  markBillPaid:   (billNo: string, amountPaid?: number) => void;
  getNextBillNo:  () => string;
  upsertCustomer: (name: string, phone: string, amount: number, credit?: number) => void;
  deleteCustomer: (id: string) => void;
  addCustomer:    (name: string, phone: string, notes?: string) => void;
  importBills:    (rows: Array<{
    date: string;
    items: { name: string; qty: number; unitPrice: number; total: number; costPrice: number }[];
    grandTotal: number; costTotal: number; createdBy: string;
  }>) => void;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const load = <T,>(key: string, def: T): T => {
    try { const s = appStorage.getItem(key); return s ? JSON.parse(s) : def; }
    catch { return def; }
  };

  const [bills,     setBills]     = useState<Bill[]>(() => load('shopshield_bills', []));
  const [customers, setCustomers] = useState<CustomerProfile[]>(() => load('shopshield_customers', []));

  useEffect(() => { appStorage.setItem('shopshield_bills',     JSON.stringify(bills));     }, [bills]);
  useEffect(() => { appStorage.setItem('shopshield_customers', JSON.stringify(customers)); }, [customers]);

  const getNextBillNo = () => {
    const max = bills.reduce((acc, b) => {
      const n = parseInt(b.billNo.replace('INV',''), 10);
      return isNaN(n) ? acc : Math.max(acc, n);
    }, 1000);
    return `INV${(max+1).toString().padStart(4,'0')}`;
  };

  const addBill = (bill: Omit<Bill, 'billNo'|'date'|'time'>): Bill => {
    const now  = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];
    const billNo = getNextBillNo();
    const full: Bill = { ...bill, billNo, date, time };
    setBills(prev => [full, ...prev]);
    // Update customer credit balance
    upsertCustomer(bill.customerName, bill.customerPhone, bill.grandTotal, bill.balance);
    return full;
  };

  const markBillPaid = (billNo: string, amountPaid?: number) => {
    const today = new Date().toISOString().split('T')[0];
    setBills(prev => prev.map(b => {
      if (b.billNo !== billNo) return b;
      const paying = amountPaid !== undefined ? amountPaid : b.balance;
      const newBalance = Math.max(0, b.balance - paying);
      const newPaid = b.amountPaid + paying;
      return {
        ...b,
        amountPaid: newPaid,
        balance: newBalance,
        status: newBalance <= 0 ? 'paid' : 'credit',
        paidDate: newBalance <= 0 ? today : undefined,
      };
    }));
    // Update customer credit
    setBills(current => {
      const bill = current.find(b => b.billNo === billNo);
      if (bill) {
        const paying = amountPaid !== undefined ? amountPaid : bill.balance;
        setCustomers(prev => prev.map(c => {
          if (c.name.toLowerCase() !== bill.customerName.toLowerCase() &&
              c.phone !== bill.customerPhone) return c;
          return { ...c, totalCredit: Math.max(0, (c.totalCredit || 0) - paying) };
        }));
      }
      return current;
    });
  };

  const upsertCustomer = (name: string, phone: string, amount: number, credit = 0) => {
    if (!name || name === 'Walk-in Customer') return;
    const today = new Date().toISOString().split('T')[0];
    setCustomers(prev => {
      const existing = prev.find(c =>
        (phone && c.phone === phone) ||
        c.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) {
        return prev.map(c => c.id === existing.id ? {
          ...c,
          totalSpent:  c.totalSpent + amount,
          visitCount:  c.visitCount + 1,
          lastVisit:   today,
          phone:       phone || c.phone,
          totalCredit: (c.totalCredit || 0) + credit,
        } : c);
      }
      return [...prev, {
        id: `C${Date.now()}`, name, phone,
        totalSpent: amount, visitCount: 1, lastVisit: today,
        totalCredit: credit,
      }];
    });
  };

  const deleteCustomer = (id: string) =>
    setCustomers(prev => prev.filter(c => c.id !== id));

  const addCustomer = (name: string, phone: string, notes?: string) => {
    if (!name.trim()) return;
    const today = new Date().toISOString().split('T')[0];
    setCustomers(prev => {
      const exists = prev.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (exists) return prev;
      return [...prev, {
        id: `C${Date.now()}`, name: name.trim(), phone: phone.trim(),
        totalSpent: 0, visitCount: 0, lastVisit: today, totalCredit: 0, notes,
      }];
    });
  };

  const importBills = (rows: Array<{
    date: string;
    items: { name: string; qty: number; unitPrice: number; total: number; costPrice: number }[];
    grandTotal: number; costTotal: number; createdBy: string;
  }>) => {
    const now  = new Date();
    const time = now.toTimeString().split(' ')[0];
    let counter = bills.length + 1001;
    const newBills: Bill[] = rows.map(r => ({
      billNo:        `INV${(counter++).toString().padStart(4,'0')}`,
      date:          r.date,
      time,
      customerName:  'Historical',
      customerPhone: '—',
      items:         r.items.map((it, i) => ({
        id:        `IMP-${i}`,
        name:      it.name,
        sku:       '—',
        qty:       it.qty,
        unitPrice: it.unitPrice,
        total:     it.total,
      })),
      subtotal:    r.grandTotal,
      discount:    0,
      grandTotal:  r.grandTotal,
      amountPaid:  r.grandTotal,
      balance:     0,
      status:      'paid' as BillStatus,
      createdBy:   r.createdBy,
      printed:     false,
    }));
    setBills(prev => [...prev, ...newBills]);
  };

  return (
    <BillingContext.Provider value={{
      bills, customers,
      addBill, markBillPaid, getNextBillNo,
      upsertCustomer, deleteCustomer, addCustomer, importBills,
    }}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error('useBilling must be within BillingProvider');
  return ctx;
}
