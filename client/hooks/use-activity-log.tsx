import { appStorage } from '@/lib/app-storage';
import React, { createContext, useContext, useState, useEffect } from 'react';

export type ActivityType = 'edit' | 'delete' | 'sale' | 'login' | 'logout' | 'add' | 'note';

export interface ActivityEntry {
  id: string;
  timestamp: string;      // ISO
  date: string;           // YYYY-MM-DD
  time: string;           // HH:MM:SS
  userId: string;
  userName: string;
  userRole: string;
  type: ActivityType;
  target: string;         // e.g. "Tool: رباط کلان (T001)"
  action: string;         // e.g. "Edited: name, costPrice"
  reason?: string;        // mandatory note for edit/delete
  before?: string;        // JSON snapshot before change
  after?: string;         // JSON snapshot after change
}

interface LogContextType {
  entries: ActivityEntry[];
  log: (entry: Omit<ActivityEntry, 'id' | 'timestamp' | 'date' | 'time'>) => void;
  clearLog: () => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export function ActivityLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ActivityEntry[]>(() => {
    try {
      const s = appStorage.getItem('shopshield_activity_log');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  useEffect(() => {
    appStorage.setItem('shopshield_activity_log', JSON.stringify(entries));
  }, [entries]);

  const log = (entry: Omit<ActivityEntry, 'id' | 'timestamp' | 'date' | 'time'>) => {
    const now = new Date();
    const newEntry: ActivityEntry = {
      ...entry,
      id: `L${Date.now()}`,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
    };
    setEntries(prev => [newEntry, ...prev].slice(0, 2000)); // keep last 2000
  };

  const clearLog = () => {
    setEntries([]);
    appStorage.removeItem('shopshield_activity_log');
  };

  return (
    <LogContext.Provider value={{ entries, log, clearLog }}>
      {children}
    </LogContext.Provider>
  );
}

export function useActivityLog() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error('useActivityLog must be within ActivityLogProvider');
  return ctx;
}
