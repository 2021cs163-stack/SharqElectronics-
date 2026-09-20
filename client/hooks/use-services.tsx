import { appStorage } from '@/lib/app-storage';
import React, { createContext, useContext, useState, useEffect } from 'react';

export type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface ServiceWorker {
  id: string;
  name: string;
  phone?: string;
  role: string;       // e.g. "Technician", "Helper"
  active: boolean;
  dateAdded: string;
  balance: number;    // positive = we owe them, negative = they owe us
}

export interface WorkerTransaction {
  id: string;
  workerId: string;
  type: 'credit' | 'debit';   // credit = pay TO worker, debit = advance/deduction
  amount: number;
  description: string;
  date: string;
  createdBy: string;
}

export interface ServiceJob {
  id: string;
  jobNo: string;                // SVC-0001
  customerName: string;
  customerPhone?: string;
  deviceType: string;
  deviceBrand?: string;
  deviceModel?: string;
  issue: string;
  status: ServiceStatus;
  assignedToId?: string;
  assignedToName?: string;
  estimatedCost?: number;
  finalCost?: number;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  dateIn: string;
  dateOut?: string;
  notes?: string;
  createdBy: string;
}

interface ServicesContextType {
  jobs: ServiceJob[];
  workers: ServiceWorker[];
  transactions: WorkerTransaction[];
  addJob: (job: Omit<ServiceJob,'id'|'jobNo'|'dateIn'|'paymentStatus'|'amountPaid'|'createdBy'>, createdBy: string) => void;
  updateJob: (id: string, updates: Partial<ServiceJob>) => void;
  deleteJob: (id: string) => void;
  addWorker: (w: Omit<ServiceWorker,'id'|'dateAdded'|'balance'>) => void;
  updateWorker: (id: string, updates: Partial<ServiceWorker>) => void;
  addTransaction: (t: Omit<WorkerTransaction,'id'>, workerId: string) => void;
}

const Ctx = createContext<ServicesContextType|undefined>(undefined);

export function ServicesProvider({ children }: { children: React.ReactNode }) {
  const [jobs,         setJobs]         = useState<ServiceJob[]>(() => { try { const s=appStorage.getItem('shopshield_service_jobs'); return s?JSON.parse(s):[]; } catch{return[];} });
  const [workers,      setWorkers]      = useState<ServiceWorker[]>(() => { try { const s=appStorage.getItem('shopshield_service_workers'); return s?JSON.parse(s):[]; } catch{return[];} });
  const [transactions, setTransactions] = useState<WorkerTransaction[]>(() => { try { const s=appStorage.getItem('shopshield_worker_txns'); return s?JSON.parse(s):[]; } catch{return[];} });

  useEffect(()=>{ appStorage.setItem('shopshield_service_jobs', JSON.stringify(jobs)); }, [jobs]);
  useEffect(()=>{ appStorage.setItem('shopshield_service_workers', JSON.stringify(workers)); }, [workers]);
  useEffect(()=>{ appStorage.setItem('shopshield_worker_txns', JSON.stringify(transactions)); }, [transactions]);

  const nextJobNo = () => {
    const max = jobs.reduce((a,j) => { const n=parseInt(j.jobNo.replace('SVC-','')); return isNaN(n)?a:Math.max(a,n); }, 0);
    return `SVC-${String(max+1).padStart(4,'0')}`;
  };

  const addJob = (job: Omit<ServiceJob,'id'|'jobNo'|'dateIn'|'paymentStatus'|'amountPaid'|'createdBy'>, createdBy: string) => {
    const newJob: ServiceJob = {
      ...job, id:`J${Date.now()}`, jobNo:nextJobNo(),
      dateIn:new Date().toISOString().split('T')[0],
      paymentStatus:'unpaid', amountPaid:0, createdBy,
    };
    setJobs(prev => [newJob, ...prev]);
  };

  const updateJob = (id: string, updates: Partial<ServiceJob>) =>
    setJobs(prev => prev.map(j => j.id===id ? {...j,...updates} : j));

  const deleteJob = (id: string) => setJobs(prev => prev.filter(j => j.id!==id));

  const addWorker = (w: Omit<ServiceWorker,'id'|'dateAdded'|'balance'>) =>
    setWorkers(prev => [...prev, {...w, id:`W${Date.now()}`, dateAdded:new Date().toISOString().split('T')[0], balance:0}]);

  const updateWorker = (id: string, updates: Partial<ServiceWorker>) =>
    setWorkers(prev => prev.map(w => w.id===id ? {...w,...updates} : w));

  const addTransaction = (t: Omit<WorkerTransaction,'id'>, workerId: string) => {
    const newT: WorkerTransaction = {...t, id:`T${Date.now()}`};
    setTransactions(prev => [newT, ...prev]);
    // Update worker balance: credit = +, debit = -
    setWorkers(prev => prev.map(w => w.id===workerId
      ? {...w, balance: w.balance + (t.type==='credit' ? t.amount : -t.amount)}
      : w));
  };

  return (
    <Ctx.Provider value={{jobs,workers,transactions,addJob,updateJob,deleteJob,addWorker,updateWorker,addTransaction}}>
      {children}
    </Ctx.Provider>
  );
}

export function useServices() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useServices must be within ServicesProvider');
  return ctx;
}
