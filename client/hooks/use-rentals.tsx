import { appStorage } from '@/lib/app-storage';
import React, { createContext, useContext, useState, useEffect } from 'react';

export type RentalStatus = 'active' | 'returned' | 'overdue';
export type RentalUnit = 'hour' | 'day' | 'week';

export interface Rental {
  id: string;
  rentalNo: string;        // RNT-0001
  toolId: string;
  toolName: string;
  toolSku: string;
  customerName: string;
  customerPhone?: string;
  startDate: string;
  startTime: string;
  duration: number;
  durationUnit: RentalUnit;
  endDate: string;
  ratePerUnit: number;
  currency: string;
  deposit?: number;
  totalCost: number;
  amountPaid: number;
  status: RentalStatus;
  returnedDate?: string;
  notes?: string;
  createdBy: string;
  dateCreated: string;
}

interface RentalsContextType {
  rentals: Rental[];
  addRental: (r: Omit<Rental,'id'|'rentalNo'|'dateCreated'|'status'|'amountPaid'|'createdBy'>, createdBy: string) => void;
  returnRental: (id: string, notes?: string) => void;
  updateRental: (id: string, updates: Partial<Rental>) => void;
  deleteRental: (id: string) => void;
  activeRentals: Rental[];
  overdueRentals: Rental[];
}

const Ctx = createContext<RentalsContextType | undefined>(undefined);
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`.toUpperCase();

function computeEndDate(startDate: string, duration: number, unit: RentalUnit): string {
  const d = new Date(startDate);
  if (unit === 'hour') d.setHours(d.getHours() + duration);
  else if (unit === 'day') d.setDate(d.getDate() + duration);
  else d.setDate(d.getDate() + duration * 7);
  return d.toISOString().split('T')[0];
}

export function RentalsProvider({ children }: { children: React.ReactNode }) {
  const [rentals, setRentals] = useState<Rental[]>(() => {
    try { const s = appStorage.getItem('shopshield_rentals'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  useEffect(() => { appStorage.setItem('shopshield_rentals', JSON.stringify(rentals)); }, [rentals]);

  // Check for overdue on load
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setRentals(prev => prev.map(r =>
      r.status === 'active' && r.endDate < today ? { ...r, status: 'overdue' } : r
    ));
  }, []);

  const nextNo = () => {
    const max = rentals.reduce((a, r) => {
      const n = parseInt(r.rentalNo.replace('RNT-', ''));
      return isNaN(n) ? a : Math.max(a, n);
    }, 0);
    return `RNT-${String(max + 1).padStart(4, '0')}`;
  };

  const addRental = (r: Omit<Rental,'id'|'rentalNo'|'dateCreated'|'status'|'amountPaid'|'createdBy'>, createdBy: string) => {
    const newR: Rental = {
      ...r, id: uid(), rentalNo: nextNo(),
      dateCreated: new Date().toISOString().split('T')[0],
      status: 'active', amountPaid: 0, createdBy,
    };
    setRentals(prev => [newR, ...prev]);
  };

  const returnRental = (id: string, notes?: string) => {
    const today = new Date().toISOString().split('T')[0];
    setRentals(prev => prev.map(r =>
      r.id === id ? { ...r, status: 'returned', returnedDate: today, notes: notes || r.notes } : r
    ));
  };

  const updateRental = (id: string, updates: Partial<Rental>) =>
    setRentals(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

  const deleteRental = (id: string) =>
    setRentals(prev => prev.filter(r => r.id !== id));

  const activeRentals = rentals.filter(r => r.status === 'active' || r.status === 'overdue');
  const overdueRentals = rentals.filter(r => r.status === 'overdue');

  return (
    <Ctx.Provider value={{ rentals, addRental, returnRental, updateRental, deleteRental, activeRentals, overdueRentals }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRentals() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRentals must be within RentalsProvider');
  return ctx;
}
