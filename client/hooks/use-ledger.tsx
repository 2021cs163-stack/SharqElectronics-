import { appStorage } from '@/lib/app-storage';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ToolStatus = "available" | "checked-out" | "repair" | "disposed" | "assigned-loss";
export type LedgerStatus = "signed" | "pending" | "warning" | "corrected";
export type LedgerAction = 
  | "Tool Added" 
  | "Checked Out" 
  | "Returned" 
  | "Repair Logged" 
  | "Repair Complete" 
  | "Assigned Loss" 
  | "Corrective Adjustment" 
  | "Day Closed - Clean" 
  | "Day Closed - With Assignments" 
  | "Disposed";
export type DayState = "open" | "closed-clean" | "closed-assigned";

export interface Tool {
  id: string;
  name: string;
  sku: string;
  category: string;
  location: string;
  status: ToolStatus;
  costPrice: number;
  dateAdded: string;
  notes?: string;
  calibrationDue?: string;
  minSellPrice?: number;
  maxSellPrice?: number;
  unit?: string;        // piece, meter, foot, kg, gram, liter, box, roll, set
  stock?: number;       // current quantity in stock (pieces, meters, kg etc.)
  lowStockThreshold?: number; // alert when stock falls to or below this
  // Pack support: items sold in packs (e.g. 100m roll → sell per meter)
  packSize?: number;    // how many units per pack (e.g. 100 for 100m roll)
  packUnit?: string;    // unit per pack item (e.g. "meter")
  // Rental support
  isRental?: boolean;   // true = available for rent
  rentalRateHour?: number;
  rentalRateDay?: number;
  rentalRateWeek?: number;
  rentalCurrency?: string;
  isCurrentlyRented?: boolean;
  // Storage / location
  cupboardNo?: string;  // optional storage location (shown but not enforced)
  shelf?: string;
}

export interface LedgerEntry {
  id: string;
  timestamp: string; // HH:MM:SS
  date: string;      // YYYY-MM-DD
  userId: string;
  userName: string;
  userRole: string;
  action: LedgerAction;
  toolId: string;
  toolName: string;
  fromLocation?: string;
  toLocation?: string;
  status: LedgerStatus;
  signedBy?: string;
  linkedEntryId?: string;
  costAtTime?: number;
  notes?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "Partner" | "Staff" | "Tech";
}

interface LedgerContextType {
  tools: Tool[];
  ledger: LedgerEntry[];
  dayState: DayState;
  addTool: (toolData: Partial<Tool>, user: User) => void;
  updateTool: (id: string, updates: Partial<Tool>, editor?: User) => void;
  deleteTool: (id: string, user?: User) => void;
  checkOutTool: (toolId: string, toLocation: string, user: User) => void;
  returnTool: (toolId: string, user: User) => void;
  logRepair: (toolId: string, notes: string, user: User) => void;
  completeRepair: (toolId: string, user: User) => void;
  disposeTool: (toolId: string, notes: string, user: User) => void;
  approveEntry: (entryId: string, approver: User) => void;
  approveAllPending: (approver: User) => void;
  closeDayClean: (user: User) => void;
  closeDayWithAssignments: (assignedIds: string[], user: User) => void;
  correctiveAdjustment: (linkedEntryId: string, notes: string, user: User) => void;
  resetAllData: () => void;
  deductStock: (toolId: string, amount: number) => void;
  addStock: (toolId: string, amount: number) => void;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

const SEED_TOOLS: Tool[] = [
  { id:"T001",name:"رباط کلان",sku:"156482",category:"Accessories",location:"Shop",status:"available",costPrice:700.0,minSellPrice:1200.0,maxSellPrice:1500.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T002",name:"رباط خورد",sku:"156438",category:"Accessories",location:"Shop",status:"available",costPrice:600.0,minSellPrice:1000.0,maxSellPrice:1200.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T003",name:"یروپ خواب محمد",sku:"156348",category:"Power",location:"Shop",status:"available",costPrice:460.0,minSellPrice:600.0,maxSellPrice:700.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T004",name:"یروپ خواب کره",sku:"15687",category:"Power",location:"Shop",status:"available",costPrice:460.0,minSellPrice:600.0,maxSellPrice:700.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T005",name:"یروپ خواب قلب",sku:"153948",category:"Power",location:"Shop",status:"available",costPrice:380.0,minSellPrice:600.0,maxSellPrice:700.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T006",name:"یروپ رنکھ یردشی لوډ سپیکردار",sku:"15644",category:"Power",location:"Shop",status:"available",costPrice:380.0,minSellPrice:600.0,maxSellPrice:800.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T007",name:"سوچ یک خانھ",sku:"15669",category:"Switches & Remotes",location:"Shop",status:"available",costPrice:45.0,minSellPrice:60.0,maxSellPrice:90.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T008",name:"سوچ دو خانھ",sku:"15645",category:"Switches & Remotes",location:"Shop",status:"available",costPrice:70.0,minSellPrice:100.0,maxSellPrice:120.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T009",name:"سوچ سھ خانھ",sku:"15646",category:"Switches & Remotes",location:"Shop",status:"available",costPrice:80.0,minSellPrice:100.0,maxSellPrice:140.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T010",name:"سوچ چھار خانھ",sku:"15668",category:"Switches & Remotes",location:"Shop",status:"available",costPrice:90.0,minSellPrice:120.0,maxSellPrice:140.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T011",name:"سوچ شش خانھ",sku:"15670",category:"Switches & Remotes",location:"Shop",status:"available",costPrice:130.0,minSellPrice:160.0,maxSellPrice:180.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T012",name:"سوچ ھشت خانھ",sku:"15671",category:"Switches & Remotes",location:"Shop",status:"available",costPrice:160.0,minSellPrice:180.0,maxSellPrice:200.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T013",name:"سوچ ده خانھ",sku:"15672",category:"Switches & Remotes",location:"Shop",status:"available",costPrice:170.0,minSellPrice:220.0,maxSellPrice:250.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T014",name:"اشاره رنکھ پنج متره",sku:"15673",category:"Pointers",location:"Shop",status:"available",costPrice:170.0,minSellPrice:250.0,maxSellPrice:300.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T015",name:"اشاره رنکھ ده متره",sku:"15674",category:"Pointers",location:"Shop",status:"available",costPrice:220.0,minSellPrice:450.0,maxSellPrice:500.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T016",name:"اشاره رنکھ پنجاه متره",sku:"15675",category:"Pointers",location:"Shop",status:"available",costPrice:500.0,minSellPrice:750.0,maxSellPrice:800.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T017",name:"هلال Type-C iPhone کیبل",sku:"c261",category:"Cables",location:"Shop",status:"available",costPrice:80.0,minSellPrice:150.0,maxSellPrice:180.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T018",name:"هلال USB Galaxy",sku:"JEyhqgZF49k",category:"Cables",location:"Shop",status:"available",costPrice:40.0,minSellPrice:80.0,maxSellPrice:100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T019",name:"هلال USB iPhone",sku:"c262",category:"Cables",location:"Shop",status:"available",costPrice:60.0,minSellPrice:100.0,maxSellPrice:120.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T020",name:"USB Type-C",sku:"8565412598252",category:"Cables",location:"Shop",status:"available",costPrice:40.0,minSellPrice:100.0,maxSellPrice:120.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T021",name:"هلال USB iPhone G5",sku:"J5IPUSB",category:"Cables",location:"Shop",status:"available",costPrice:45.0,minSellPrice:100.0,maxSellPrice:120.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T022",name:"NS Galaxy Cable V8",sku:"CableV8",category:"Cables",location:"Shop",status:"available",costPrice:70.0,minSellPrice:120.0,maxSellPrice:150.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T023",name:"هلال 12F موبر کیبل",sku:"CC12HF",category:"Cables",location:"Shop",status:"available",costPrice:120.0,minSellPrice:220.0,maxSellPrice:250.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T024",name:"هلال چارجر او اډپتر",sku:"HCAA",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:380.0,minSellPrice:550.0,maxSellPrice:580.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T025",name:"هلال چارجر او اډپتر 8F",sku:"HCAA8F",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:200.0,minSellPrice:300.0,maxSellPrice:350.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T026",name:"هلال چارجر 1200B",sku:"1200HCB",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:40.0,minSellPrice:100.0,maxSellPrice:120.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T027",name:"هلال چارجر 2J",sku:"2HCAJ",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:30.0,minSellPrice:80.0,maxSellPrice:100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T028",name:"هلال چارجر 11S",sku:"11HCS",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:210.0,minSellPrice:350.0,maxSellPrice:400.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T029",name:"یوشکی بلوتوت iPhone هلال",sku:"HSIP",category:"Audio",location:"Shop",status:"available",costPrice:420.0,minSellPrice:900.0,maxSellPrice:1000.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T030",name:"یوشکی بلوتوت هلال",sku:"250-B",category:"Audio",location:"Shop",status:"available",costPrice:200.0,minSellPrice:450.0,maxSellPrice:500.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T031",name:"یوشکی لینی هلال",sku:"290-M",category:"Audio",location:"Shop",status:"available",costPrice:40.0,minSellPrice:80.0,maxSellPrice:100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T032",name:"یوشکی لینی هلال iPhone",sku:"HSIPH",category:"Audio",location:"Shop",status:"available",costPrice:80.0,minSellPrice:220.0,maxSellPrice:250.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T033",name:"یوشکی لینی هلال iPhone Type-C",sku:"HSIPLC",category:"Cables",location:"Shop",status:"available",costPrice:120.0,minSellPrice:250.0,maxSellPrice:300.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T034",name:"هلال iPhone لاین W48",sku:"260-c",category:"Accessories",location:"Shop",status:"available",costPrice:60.0,minSellPrice:120.0,maxSellPrice:150.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T035",name:"iPhone بی قوطی Type-C",sku:"IPLCNBX",category:"Cables",location:"Shop",status:"available",costPrice:90.0,minSellPrice:220.0,maxSellPrice:250.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T036",name:"Galaxy بی قوطی",sku:"GLCNBX",category:"Accessories",location:"Shop",status:"available",costPrice:30.0,minSellPrice:50.0,maxSellPrice:60.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T037",name:"GIONEE یوشکی لینی",sku:"GIL",category:"Audio",location:"Shop",status:"available",costPrice:40.0,minSellPrice:100.0,maxSellPrice:120.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T038",name:"هلال یوشکی لینی 296M",sku:"296M",category:"Audio",location:"Shop",status:"available",costPrice:40.0,minSellPrice:100.0,maxSellPrice:120.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T039",name:"هلال یوشکی لینی 935M",sku:"935M",category:"Audio",location:"Shop",status:"available",costPrice:45.0,minSellPrice:80.0,maxSellPrice:100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T040",name:"صالح کیبل ۳ کاره",sku:"80S",category:"Cables",location:"Shop",status:"available",costPrice:35.0,minSellPrice:100.0,maxSellPrice:120.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T041",name:"صوت البدر چارجر DC",sku:"YC-202",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:70.0,minSellPrice:120.0,maxSellPrice:150.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T042",name:"صوت البدر پاور بانک 20000 MAH",sku:"K20SBPB",category:"Power",location:"Shop",status:"available",costPrice:550.0,minSellPrice:1000.0,maxSellPrice:1100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T043",name:"AULGE Type-C کیبل",sku:"6971588033497",category:"Cables",location:"Shop",status:"available",costPrice:25.0,minSellPrice:80.0,maxSellPrice:100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T044",name:"UEELQ 35W",sku:"6974489722972",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:80.0,minSellPrice:200.0,maxSellPrice:250.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T045",name:"هلال Type-C to USB OTG",sku:"OT7",category:"Cables",location:"Shop",status:"available",costPrice:7.0,minSellPrice:8.0,maxSellPrice:20.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T046",name:"هلال پین",sku:"HPIN",category:"Accessories",location:"Shop",status:"available",costPrice:2.0,minSellPrice:5.0,maxSellPrice:10.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T047",name:"هلال کارډ ریډر 2 USB",sku:"2HCRU",category:"Storage",location:"Shop",status:"available",costPrice:20.0,minSellPrice:11.0,maxSellPrice:20.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T048",name:"هلال کارډ ریډر 3 USB",sku:"3HCRU",category:"Storage",location:"Shop",status:"available",costPrice:30.0,minSellPrice:13.0,maxSellPrice:30.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T049",name:"تیلیفون ستنډ",sku:"TSTAND",category:"Accessories",location:"Shop",status:"available",costPrice:40.0,minSellPrice:80.0,maxSellPrice:100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T050",name:"یوشکی لینی سمسنک ربی قطی",sku:"8RFTJ",category:"Audio",location:"Shop",status:"available",costPrice:32.0,minSellPrice:80.0,maxSellPrice:100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T051",name:"اډپتر بی قطی زرد W120",sku:"5488",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:75.0,minSellPrice:120.0,maxSellPrice:150.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T052",name:"اډپتر ساده",sku:"ROHS",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:28.0,minSellPrice:50.0,maxSellPrice:60.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T053",name:"SanDisk Flash Drive 64GB",sku:"619659173975",category:"Storage",location:"Shop",status:"available",costPrice:200.0,minSellPrice:350.0,maxSellPrice:400.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T054",name:"SanDisk Flash Drive 32GB",sku:"619659173976",category:"Storage",location:"Shop",status:"available",costPrice:160.0,minSellPrice:350.0,maxSellPrice:300.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T055",name:"SanDisk Flash Drive 16GB",sku:"619659173977",category:"Storage",location:"Shop",status:"available",costPrice:140.0,minSellPrice:200.0,maxSellPrice:250.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T056",name:"لین بی قطی Type-C",sku:"LTCNBX",category:"Cables",location:"Shop",status:"available",costPrice:28.0,minSellPrice:80.0,maxSellPrice:100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T057",name:"لین بی قطی Galaxy W120",sku:"LGNBX",category:"Accessories",location:"Shop",status:"available",costPrice:30.0,minSellPrice:80.0,maxSellPrice:100.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T058",name:"لاسپیکر وایرلیس مینی",sku:"WLS3MP",category:"Audio",location:"Shop",status:"available",costPrice:95.0,minSellPrice:150.0,maxSellPrice:180.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T059",name:"اشاره قلب DC",sku:"IQDC",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:28.0,minSellPrice:60.0,maxSellPrice:80.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T060",name:"اشاره ریکشایی DC",sku:"IRDC",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:4.0,minSellPrice:7.0,maxSellPrice:10.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T061",name:"اشاره اول DC",sku:"I1DC",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:4.0,minSellPrice:9.0,maxSellPrice:10.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T062",name:"اشاره پولیسی DC",sku:"DCPO",category:"Chargers & Adapters",location:"Shop",status:"available",costPrice:25.0,minSellPrice:40.0,maxSellPrice:50.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T063",name:"کارډ میموری 16GB",sku:"MC16GB",category:"Storage",location:"Shop",status:"available",costPrice:140.0,minSellPrice:250.0,maxSellPrice:280.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T064",name:"کارډ میموری 32GB",sku:"MC32GB",category:"Storage",location:"Shop",status:"available",costPrice:180.0,minSellPrice:300.0,maxSellPrice:320.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T065",name:"یروپ USB یک طرفه خورد",sku:"S1USBG",category:"Power",location:"Shop",status:"available",costPrice:9.0,minSellPrice:15.0,maxSellPrice:20.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T066",name:"یروپ USB دو طرفه خورد",sku:"S2USBG",category:"Power",location:"Shop",status:"available",costPrice:11.0,minSellPrice:20.0,maxSellPrice:25.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T067",name:"یروپ USB یک طرفه کلان",sku:"L1USBG",category:"Power",location:"Shop",status:"available",costPrice:19.0,minSellPrice:25.0,maxSellPrice:30.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T068",name:"سویچ ریموټ کنترول YKi",sku:"YKIRCS",category:"Switches & Remotes",location:"Shop",status:"available",costPrice:420.0,minSellPrice:550.0,maxSellPrice:600.0,dateAdded:"2026-04-13",notes:"" },
  { id:"T069",name:"زنک دروازه بی لین دوم",sku:"DRSCKNDB",category:"Accessories",location:"Shop",status:"available",costPrice:120.0,minSellPrice:180.0,maxSellPrice:200.0,dateAdded:"2026-04-13",notes:"" },
];

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [tools, setTools] = useState<Tool[]>(() => {
    try {
      const saved = appStorage.getItem('shopshield_tools');
      if (!saved) return SEED_TOOLS;
      const parsed: Tool[] = JSON.parse(saved);
      // Detect old demo data by checking for known demo SKUs
      const isOldDemoData = parsed.some(t =>
        ['DW-DRILL-001','MIL-IMP-02','MAK-SAW-01','BOS-LAS-99','FLU-MUL-01'].includes(t.sku)
      );
      if (isOldDemoData) {
        // Auto-replace with real Sharq inventory
        appStorage.removeItem('shopshield_tools');
        appStorage.removeItem('shopshield_ledger');
        appStorage.removeItem('shopshield_day_state');
        return SEED_TOOLS;
      }
      // Deduplicate IDs — batch CSV imports created duplicate IDs previously
      const seenIds = new Set<string>();
      const deduped = parsed.map(t => {
        if (!t.id || seenIds.has(t.id)) {
          const ts  = Date.now().toString(36).toUpperCase();
          const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
          const newId = `T${ts}${rnd}`;
          seenIds.add(newId);
          return { ...t, id: newId };
        }
        seenIds.add(t.id);
        return t;
      });
      // If we fixed any duplicates, persist immediately
      if (deduped.some((t, i) => t.id !== parsed[i].id)) {
        appStorage.setItem('shopshield_tools', JSON.stringify(deduped));
      }
      return deduped;
    } catch { return SEED_TOOLS; }
  });

  const [ledger, setLedger] = useState<LedgerEntry[]>(() => {
    const saved = appStorage.getItem('shopshield_ledger');
    return saved ? JSON.parse(saved) : [];
  });

  const [dayState, setDayState] = useState<DayState>(() => {
    const saved = appStorage.getItem('shopshield_day_state');
    return (saved as DayState) || "open";
  });

  useEffect(() => {
    appStorage.setItem('shopshield_tools', JSON.stringify(tools));
    appStorage.setItem('shopshield_ledger', JSON.stringify(ledger));
    appStorage.setItem('shopshield_day_state', dayState);
  }, [tools, ledger, dayState]);

  const createEntry = useCallback((action: LedgerAction, tool: Tool, user: User, overrides: Partial<LedgerEntry> = {}): LedgerEntry => {
    const now = new Date();
    return {
      id: `L${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
      timestamp: now.toTimeString().split(' ')[0],
      date: now.toISOString().split('T')[0],
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      toolId: tool.id,
      toolName: tool.name,
      costAtTime: tool.costPrice,
      status: user.role === 'Partner' ? 'signed' : 'pending',
      ...overrides
    };
  }, []);

  const addTool = (toolData: Partial<Tool>, user: User) => {
    // Use timestamp + random to guarantee uniqueness (tools.length causes
    // duplicate IDs when multiple items are imported in rapid succession)
    const ts  = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
    const id  = toolData.id || `T${ts}${rnd}`;
    const newTool: Tool = {
      id,
      name: toolData.name || "Unnamed Tool",
      sku: toolData.sku || "NO-SKU",
      category: toolData.category || "Other",
      location: toolData.location || "Warehouse",
      status: "available",
      costPrice: toolData.costPrice || 0,
      dateAdded: new Date().toISOString().split('T')[0],
      notes: toolData.notes,
      calibrationDue: toolData.calibrationDue,
      minSellPrice: toolData.minSellPrice,
      maxSellPrice: toolData.maxSellPrice,
      unit: toolData.unit || 'piece',
      stock: toolData.stock !== undefined ? toolData.stock : undefined,
      lowStockThreshold: toolData.lowStockThreshold,
    };

    const entry = createEntry("Tool Added", newTool, user);
    setTools(prev => [...prev, newTool]);
    setLedger(prev => [entry, ...prev]);
  };

  const updateTool = (id: string, updates: Partial<Tool>, editor?: User) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (editor) {
      const tool = tools.find(t => t.id === id);
      if (tool) {
        const fields = Object.keys(updates).join(', ');
        const entry = createEntry('Corrective Adjustment' as LedgerAction, { ...tool, ...updates }, editor, {});
        const logEntry = { ...entry, notes: `Edited: ${fields}` };
        setLedger(prev => [logEntry, ...prev]);
      }
    }
  };

  const deleteTool = (id: string, user?: User) => {
    const tool = tools.find(t => t.id === id);
    setTools(prev => prev.filter(t => t.id !== id));
    if (user && tool) {
      const entry = createEntry('Disposed' as LedgerAction, tool, user, {});
      const logEntry = { ...entry, notes: `Deleted by ${user.name}` };
      setLedger(prev => [logEntry, ...prev]);
    } else {
      setLedger(prev => prev.filter(e => e.toolId !== id));
    }
  };

  const checkOutTool = (toolId: string, toLocation: string, user: User) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    const entry = createEntry("Checked Out", tool, user, {
      fromLocation: tool.location,
      toLocation
    });

    setLedger(prev => [entry, ...prev]);
    if (user.role === 'Partner') {
      setTools(prev => prev.map(t => t.id === toolId ? { ...t, status: 'checked-out', location: toLocation } : t));
    }
  };

  const returnTool = (toolId: string, user: User) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    const entry = createEntry("Returned", tool, user, {
      fromLocation: tool.location,
      toLocation: "Warehouse"
    });

    setLedger(prev => [entry, ...prev]);
    if (user.role === 'Partner') {
      setTools(prev => prev.map(t => t.id === toolId ? { ...t, status: 'available', location: "Warehouse" } : t));
    }
  };

  const logRepair = (toolId: string, notes: string, user: User) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    const entry = createEntry("Repair Logged", tool, user, { notes });
    setLedger(prev => [entry, ...prev]);
    if (user.role === 'Partner') {
      setTools(prev => prev.map(t => t.id === toolId ? { ...t, status: 'repair' } : t));
    }
  };

  const completeRepair = (toolId: string, user: User) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    const entry = createEntry("Repair Complete", tool, user);
    setLedger(prev => [entry, ...prev]);
    if (user.role === 'Partner') {
      setTools(prev => prev.map(t => t.id === toolId ? { ...t, status: 'available' } : t));
    }
  };

  const disposeTool = (toolId: string, notes: string, user: User) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    const entry = createEntry("Disposed", tool, user, { notes });
    setLedger(prev => [entry, ...prev]);
    if (user.role === 'Partner') {
      setTools(prev => prev.map(t => t.id === toolId ? { ...t, status: 'disposed' } : t));
    }
  };

  const approveEntry = (entryId: string, approver: User) => {
    if (approver.role !== 'Partner') return;

    const entry = ledger.find(e => e.id === entryId);
    if (!entry || entry.status !== 'pending') return;

    // Update entry
    setLedger(prev => prev.map(e => e.id === entryId ? { ...e, status: 'signed', signedBy: approver.name } : e));

    // Update tool status based on the action
    setTools(prev => prev.map(t => {
      if (t.id === entry.toolId) {
        let newStatus = t.status;
        let newLocation = t.location;
        switch (entry.action) {
          case "Checked Out": newStatus = 'checked-out'; newLocation = entry.toLocation!; break;
          case "Returned": newStatus = 'available'; newLocation = 'Warehouse'; break;
          case "Repair Logged": newStatus = 'repair'; break;
          case "Repair Complete": newStatus = 'available'; break;
          case "Disposed": newStatus = 'disposed'; break;
          case "Tool Added": newStatus = 'available'; break;
        }
        return { ...t, status: newStatus, location: newLocation };
      }
      return t;
    }));
  };

  const approveAllPending = (approver: User) => {
    if (approver.role !== 'Partner') return;
    ledger.filter(e => e.status === 'pending').forEach(e => approveEntry(e.id, approver));
  };

  const closeDayClean = (user: User) => {
    if (user.role !== 'Partner') return;
    approveAllPending(user);
    
    // Create closure entry for one tool just to satisfy the schema or a generic entry?
    // The spec says LedgerEntry("Day Closed - Clean")
    // I'll pick a dummy tool or use toolId="NONE"
    const now = new Date();
    const closure: LedgerEntry = {
      id: `L${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
      timestamp: now.toTimeString().split(' ')[0],
      date: now.toISOString().split('T')[0],
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Day Closed - Clean",
      toolId: "SYSTEM",
      toolName: "System Closure",
      status: "signed",
      signedBy: user.name
    };

    setLedger(prev => [closure, ...prev]);
    setDayState("closed-clean");
  };

  const closeDayWithAssignments = (assignedIds: string[], user: User) => {
    if (user.role !== 'Partner') return;
    approveAllPending(user);

    assignedIds.forEach(toolId => {
      const tool = tools.find(t => t.id === toolId);
      if (tool) {
        const entry = createEntry("Assigned Loss", tool, user, { status: 'signed' });
        setLedger(prev => [entry, ...prev]);
        setTools(prev => prev.map(t => t.id === toolId ? { ...t, status: 'assigned-loss' } : t));
      }
    });

    const now = new Date();
    const closure: LedgerEntry = {
      id: `L${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
      timestamp: now.toTimeString().split(' ')[0],
      date: now.toISOString().split('T')[0],
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "Day Closed - With Assignments",
      toolId: "SYSTEM",
      toolName: "System Closure",
      status: "signed",
      signedBy: user.name
    };

    setLedger(prev => [closure, ...prev]);
    setDayState("closed-assigned");
  };

  const correctiveAdjustment = (linkedEntryId: string, notes: string, user: User) => {
    if (user.role !== 'Partner') return;

    const originalEntry = ledger.find(e => e.id === linkedEntryId);
    if (!originalEntry) return;

    const tool = tools.find(t => t.id === originalEntry.toolId);
    if (!tool) return;

    // Mark original as corrected
    setLedger(prev => prev.map(e => e.id === linkedEntryId ? { ...e, status: 'corrected' } : e));

    // Restore tool to available
    setTools(prev => prev.map(t => t.id === tool.id ? { ...t, status: 'available', location: "Warehouse" } : t));

    // New entry
    const adjustment = createEntry("Corrective Adjustment", tool, user, { linkedEntryId, notes, status: 'signed' });
    setLedger(prev => [adjustment, ...prev]);
  };

  const deductStock = (toolId: string, amount: number) => {
    setTools(prev => prev.map(t => t.id === toolId && t.stock !== undefined
      ? { ...t, stock: Math.max(0, t.stock - amount) }
      : t));
  };

  const addStock = (toolId: string, amount: number) => {
    setTools(prev => prev.map(t => t.id === toolId
      ? { ...t, stock: (t.stock ?? 0) + amount }
      : t));
  };

  const resetAllData = () => {
    setTools([]);
    setLedger([]);
    setDayState("open");
    appStorage.removeItem('shopshield_tools');
    appStorage.removeItem('shopshield_ledger');
    appStorage.removeItem('shopshield_day_state');
  };

  return (
    <LedgerContext.Provider value={{ 
      tools, ledger, dayState, 
      addTool, updateTool, deleteTool, checkOutTool, returnTool, logRepair, completeRepair, disposeTool,
      deductStock, addStock,
      approveEntry, approveAllPending, closeDayClean, closeDayWithAssignments, correctiveAdjustment,
      resetAllData
    }}>
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (context === undefined) {
    throw new Error('useLedger must be used within a LedgerProvider');
  }
  return context;
}
