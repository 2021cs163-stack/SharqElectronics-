import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import nacl from 'tweetnacl';

export interface User {
  id: string;
  name: string;
  role: 'Partner' | 'Staff' | 'Technician';
}

export interface Tool {
  id: string;
  name: string;
  location: string;
  status: 'available' | 'checked-out' | 'maintenance';
  category: string;
  lastUsedBy?: string;
  lastMaintenance?: string;
}

export interface Transaction {
  id: string;
  toolId: string;
  toolName: string;
  user: string;
  type: 'check-in' | 'check-out' | 'maintenance-start' | 'maintenance-end';
  timestamp: string;
  status: 'success' | 'pending' | 'flagged';
  signature?: string;
}

interface ShopContextType {
  tools: Tool[];
  transactions: Transaction[];
  currentUser: User;
  setCurrentUser: (user: User) => void;
  checkOut: (toolId: string, user: string) => void;
  checkIn: (toolId: string, user: string) => void;
  addTool: (tool: Omit<Tool, 'status'>) => void;
  updateToolStatus: (toolId: string, status: Tool['status']) => void;
  approveTransaction: (txId: string) => void;
  verifySignature: (tx: Transaction) => boolean;
  systemPublicKey: string;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

const USERS: User[] = [
  { id: "U1", name: "Robert De Niro", role: "Partner" },
  { id: "U2", name: "Al Pacino", role: "Staff" },
  { id: "U3", name: "Joe Pesci", role: "Technician" },
];

const INITIAL_TOOLS: Tool[] = [
  { id: "TOOL-001", name: "Industrial Drill Bit Set", location: "Rack 4, Bin B", status: "available", category: "Power Tools", lastMaintenance: "2023-10-12" },
  { id: "TOOL-002", name: "Heavy Duty Wrench", location: "Wall A, Slot 12", status: "checked-out", category: "Hand Tools", lastUsedBy: "Al Pacino" },
  { id: "TOOL-003", name: "Laser Level Pro", location: "Cabinet 2, Shelf 1", status: "available", category: "Measurement" },
  { id: "TOOL-004", name: "Angle Grinder 9 inch", location: "Rack 1, Bin D", status: "maintenance", category: "Power Tools" },
  { id: "TOOL-005", name: "Pneumatic Nail Gun", location: "Tool Chest 3", status: "available", category: "Pneumatic" },
  { id: "TOOL-006", name: "Digital Multimeter", location: "Electronics Bench", status: "checked-out", category: "Electronics", lastUsedBy: "Sarah Connor" },
];

const INITIAL_TXS: Transaction[] = [
  { id: "TX-9001", toolId: "TOOL-001", toolName: "Industrial Drill Bit Set", user: "John Doe", type: "check-out", timestamp: "2023-10-24 09:15", status: "success" },
  { id: "TX-9002", toolId: "TOOL-002", toolName: "Heavy Duty Wrench", user: "Alex Smith", type: "check-in", timestamp: "2023-10-24 10:30", status: "success" },
];

// Utility functions for Uint8Array <-> Hex conversion
const toHex = (data: Uint8Array) => Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

export function ShopProvider({ children }: { children: ReactNode }) {
  // Load from localStorage or use defaults
  const [tools, setTools] = useState<Tool[]>(() => {
    const saved = localStorage.getItem('shopshield_tools');
    return saved ? JSON.parse(saved) : INITIAL_TOOLS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('shopshield_txs');
    return saved ? JSON.parse(saved) : INITIAL_TXS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('shopshield_user');
    return saved ? JSON.parse(saved) : USERS[1]; // Default to Al Pacino (Staff)
  });

  const [keyPair, setKeyPair] = useState<nacl.SignKeyPair>(() => {
    const saved = localStorage.getItem('shopshield_keys');
    if (saved) {
      const { publicKey, secretKey } = JSON.parse(saved);
      return {
        publicKey: fromHex(publicKey),
        secretKey: fromHex(secretKey)
      };
    }
    const newKeys = nacl.sign.keyPair();
    localStorage.setItem('shopshield_keys', JSON.stringify({
      publicKey: toHex(newKeys.publicKey),
      secretKey: toHex(newKeys.secretKey)
    }));
    return newKeys;
  });

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem('shopshield_tools', JSON.stringify(tools));
  }, [tools]);

  useEffect(() => {
    localStorage.setItem('shopshield_txs', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('shopshield_user', JSON.stringify(currentUser));
  }, [currentUser]);

  const signTransaction = useCallback((tx: Omit<Transaction, 'signature'>) => {
    const data = new TextEncoder().encode(JSON.stringify({
      id: tx.id,
      toolId: tx.toolId,
      user: tx.user,
      type: tx.type,
      timestamp: tx.timestamp
    }));
    const signature = nacl.sign.detached(data, keyPair.secretKey);
    return toHex(signature);
  }, [keyPair]);

  const verifySignature = useCallback((tx: Transaction) => {
    if (!tx.signature) return false;
    const data = new TextEncoder().encode(JSON.stringify({
      id: tx.id,
      toolId: tx.toolId,
      user: tx.user,
      type: tx.type,
      timestamp: tx.timestamp
    }));
    try {
      return nacl.sign.detached.verify(data, fromHex(tx.signature), keyPair.publicKey);
    } catch (e) {
      return false;
    }
  }, [keyPair]);

  const addTransaction = (tool: Tool, user: string, type: Transaction['type'], customStatus?: Transaction['status']) => {
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0].substring(0, 16);
    const id = `TX-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

    // Status depends on user role if not explicitly provided
    // Partners get immediate success, Staff gets pending check-outs
    let status: Transaction['status'] = customStatus || 'success';
    if (!customStatus && currentUser.role === 'Staff' && type === 'check-out') {
      status = 'pending';
    }

    const tx: Omit<Transaction, 'signature'> = {
      id,
      toolId: tool.id,
      toolName: tool.name,
      user,
      type,
      timestamp,
      status
    };

    const signature = signTransaction(tx);
    const signedTx: Transaction = { ...tx, signature };

    setTransactions(prev => [signedTx, ...prev]);
    return signedTx;
  };

  const checkOut = (toolId: string, user: string) => {
    setTools(prev => prev.map(t => {
      if (t.id === toolId) {
        const tx = addTransaction(t, user, 'check-out');
        // Only update tool status immediately if not pending
        if (tx.status === 'success') {
          return { ...t, status: 'checked-out' as const, lastUsedBy: user };
        }
        return t; // Tool stays available but transaction is pending
      }
      return t;
    }));
  };

  const checkIn = (toolId: string, user: string) => {
    setTools(prev => prev.map(t => {
      if (t.id === toolId) {
        const updated = { ...t, status: 'available' as const, lastUsedBy: undefined };
        addTransaction(updated, user, 'check-in');
        return updated;
      }
      return t;
    }));
  };

  const approveTransaction = (txId: string) => {
    if (currentUser.role !== 'Partner') return;

    setTransactions(prev => prev.map(tx => {
      if (tx.id === txId && tx.status === 'pending') {
        // Find the tool and update it
        setTools(toolsPrev => toolsPrev.map(tool => {
          if (tool.id === tx.toolId) {
            return { ...tool, status: 'checked-out' as const, lastUsedBy: tx.user };
          }
          return tool;
        }));
        return { ...tx, status: 'success' as const };
      }
      return tx;
    }));
  };

  const addTool = (tool: Omit<Tool, 'status'>) => {
    setTools(prev => [...prev, { ...tool, status: 'available' }]);
  };

  const updateToolStatus = (toolId: string, status: Tool['status']) => {
    setTools(prev => prev.map(t => t.id === toolId ? { ...t, status } : t));
  };

  return (
    <ShopContext.Provider value={{
      tools,
      transactions,
      currentUser,
      setCurrentUser,
      checkOut,
      checkIn,
      addTool,
      updateToolStatus,
      approveTransaction,
      verifySignature,
      systemPublicKey: toHex(keyPair.publicKey)
    }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
