import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";

export interface Tool {
  id: string;
  name: string;
  location: string;
  status: "available" | "checked-out" | "maintenance";
  category: string;
  lastInspected?: string;
  image?: string;
}

export interface Transaction {
  id: string;
  toolId: string;
  toolName: string;
  user: string;
  type: "check-in" | "check-out";
  timestamp: string;
  status: "success" | "pending" | "flagged";
}

interface InventoryContextType {
  tools: Tool[];
  transactions: Transaction[];
  addTool: (tool: Omit<Tool, "status">) => void;
  updateToolStatus: (id: string, status: Tool["status"], user: string) => void;
  getTool: (id: string) => Tool | undefined;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const INITIAL_TOOLS: Tool[] = [
  { id: "TOOL-001", name: "Industrial Drill Bit Set", location: "Rack 4, Bin B", status: "available", category: "Power Tools", lastInspected: "2023-10-12" },
  { id: "TOOL-002", name: "Heavy Duty Wrench", location: "Wall A, Slot 12", status: "checked-out", category: "Hand Tools", lastInspected: "2023-09-28" },
  { id: "TOOL-003", name: "Laser Level Pro", location: "Cabinet 2, Shelf 1", status: "available", category: "Measurement", lastInspected: "2023-10-05" },
  { id: "TOOL-004", name: "Angle Grinder 9 inch", location: "Rack 1, Bin D", status: "maintenance", category: "Power Tools", lastInspected: "2023-10-20" },
  { id: "TOOL-005", name: "Pneumatic Nail Gun", location: "Tool Chest 3", status: "available", category: "Pneumatic", lastInspected: "2023-10-15" },
  { id: "TOOL-006", name: "Digital Multimeter", location: "Electronics Bench", status: "checked-out", category: "Electronics", lastInspected: "2023-10-01" },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: "TX-9001", toolName: "Industrial Drill Bit Set", toolId: "TOOL-001", user: "John Doe", type: "check-out", timestamp: "2023-10-24 09:15", status: "success" },
  { id: "TX-9002", toolName: "Heavy Duty Wrench", toolId: "TOOL-002", user: "Alex Smith", type: "check-in", timestamp: "2023-10-24 10:30", status: "success" },
];

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useState<Tool[]>(() => {
    const saved = localStorage.getItem("shopshield_tools");
    return saved ? JSON.parse(saved) : INITIAL_TOOLS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem("shopshield_transactions");
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  useEffect(() => {
    localStorage.setItem("shopshield_tools", JSON.stringify(tools));
  }, [tools]);

  useEffect(() => {
    localStorage.setItem("shopshield_transactions", JSON.stringify(transactions));
  }, [transactions]);

  const addTool = (tool: Omit<Tool, "status">) => {
    setTools(prev => [...prev, { ...tool, status: "available" }]);
    toast.success(`${tool.name} added to inventory`);
  };

  const updateToolStatus = (id: string, status: Tool["status"], user: string) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    
    const tool = tools.find(t => t.id === id);
    if (tool) {
      const newTx: Transaction = {
        id: `TX-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        toolId: id,
        toolName: tool.name,
        user,
        type: status === "available" ? "check-in" : "check-out",
        timestamp: new Date().toLocaleString(),
        status: "success"
      };
      setTransactions(prev => [newTx, ...prev]);
      toast.success(`${tool.name} marked as ${status}`);
    }
  };

  const getTool = (id: string) => tools.find(t => t.id === id);

  return (
    <InventoryContext.Provider value={{ tools, transactions, addTool, updateToolStatus, getTool }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
}
