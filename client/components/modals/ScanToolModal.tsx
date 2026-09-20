import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, ArrowLeft, Package, CheckCircle2, Wrench,
  ArrowUpRight, ArrowDownLeft, Zap, Plus, Minus, Scale, X } from 'lucide-react';
import { useScanner } from '@/hooks/use-scanner';
import { useLedger, Tool } from '@/hooks/use-ledger';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const LOCATIONS = ["Shop", "Site A", "Site B", "Site C", "Truck A", "Truck B", "Warehouse"];

// Items flagged as sold by weight (grams) — match by partial SKU/name
const WEIGHTED_KEYWORDS = ['screw','nut','bolt','nail','washer','pin','peg','rivet','packing','bulk',
  'پیچ','میخ','سوراخ','دانه','کیلو','گرام'];

function isWeighted(tool: Tool): boolean {
  const n = (tool.name + tool.sku + (tool.category||'')).toLowerCase();
  return WEIGHTED_KEYWORDS.some(k => n.includes(k));
}

interface CartItem { tool: Tool; qty: number; grams?: number }

interface ScanToolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialToolId?: string;
}

export function ScanToolModal({ open, onOpenChange, initialToolId }: ScanToolModalProps) {
  const { tools, checkOutTool, returnTool, logRepair } = useLedger();
  const { user } = useAuth();

  const [step,         setStep]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [action,       setAction]       = useState<'checkout'|'return'|'repair'|null>(null);
  const [destination,  setDestination]  = useState(LOCATIONS[0]);
  const [notes,        setNotes]        = useState('');
  const [fromScanner,  setFromScanner]  = useState(false);

  // Weight prompt
  const [showWeight, setShowWeight] = useState(false);
  const [weightInput,setWeightInput]= useState('');

  // Multi-checkout cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartMode, setCartMode] = useState(false);

  useEffect(() => {
    if (open && initialToolId) {
      const tool = tools.find(t =>
        t.id.toLowerCase() === initialToolId.toLowerCase() ||
        t.sku.toLowerCase() === initialToolId.toLowerCase()
      );
      if (tool) {
        setSelectedTool(tool);
        setFromScanner(true);
        if (isWeighted(tool)) { setShowWeight(true); }
        else setStep(2);
      } else {
        setSearch(initialToolId);
        setFromScanner(true);
        setStep(1);
      }
    }
  }, [open, initialToolId, tools]);

  const filteredTools = useMemo(() => {
    if (!search) return tools.filter(t => t.status === 'available').slice(0, 8);
    const s = search.toLowerCase();
    return tools.filter(t =>
      t.name.toLowerCase().includes(s) ||
      t.id.toLowerCase().includes(s) ||
      t.sku.toLowerCase().includes(s)
    ).slice(0, 8);
  }, [tools, search]);

  const fullReset = () => {
    setStep(1); setSearch(''); setSelectedTool(null); setAction(null);
    setDestination(LOCATIONS[0]); setNotes(''); setFromScanner(false);
    setShowWeight(false); setWeightInput(''); setCart([]); setCartMode(false);
  };

  useScanner({
    enabled: open && step === 1 && !showWeight,
    onScan: (code) => {
      const tool = tools.find(t =>
        t.id.toLowerCase() === code.toLowerCase() ||
        t.sku.toLowerCase() === code.toLowerCase()
      );
      if (tool) {
        setSelectedTool(tool);
        setFromScanner(true);
        if (isWeighted(tool)) { setShowWeight(true); }
        else if (cartMode) { addToCart(tool, 1); }
        else setStep(2);
      } else {
        setSearch(code);
        setFromScanner(true);
      }
    },
  });

  const addToCart = (tool: Tool, qty: number, grams?: number) => {
    setCart(prev => {
      const ex = prev.find(c => c.tool.id === tool.id);
      if (ex) return prev.map(c => c.tool.id === tool.id ? { ...c, qty: c.qty + qty } : c);
      return [...prev, { tool, qty, grams }];
    });
    setSearch('');
  };

  const confirmWeight = () => {
    if (!selectedTool) return;
    const g = parseFloat(weightInput) || 0;
    if (cartMode) { addToCart(selectedTool, 1, g); }
    else { setStep(2); }
    setShowWeight(false);
    setWeightInput('');
  };

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) setTimeout(fullReset, 300);
  };

  const handleConfirm = () => {
    if (!user) return;
    if (cartMode && cart.length > 0) {
      // Checkout all items in cart
      cart.forEach(item => {
        if (item.tool.status === 'available') checkOutTool(item.tool.id, destination, user);
      });
    } else if (selectedTool) {
      if (action === 'checkout') checkOutTool(selectedTool.id, destination, user);
      else if (action === 'return') returnTool(selectedTool.id, user);
      else if (action === 'repair') logRepair(selectedTool.id, notes, user);
    }
    setStep(4);
  };

  const selectTool = (tool: Tool) => {
    setSelectedTool(tool);
    if (isWeighted(tool)) { setShowWeight(true); }
    else if (cartMode) { addToCart(tool, 1); }
    else setStep(2);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg p-0 overflow-hidden max-h-[90vh]">
        <div className="p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg border",
                fromScanner ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-primary/10 text-primary border-primary/20")}>
                {fromScanner ? <Zap className="h-5 w-5"/> : <Search className="h-5 w-5"/>}
              </div>
              <div className="flex-1">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">
                  {step === 4 ? 'Done' : cartMode ? `Cart (${cart.length})` : 'Scan Equipment'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                  {step === 4 ? 'Entry recorded' : fromScanner && step > 1 ? '⚡ Scanner active' : 'Search or scan barcode'}
                </DialogDescription>
              </div>
              {/* Cart mode toggle */}
              {step === 1 && (
                <button onClick={() => setCartMode(m => !m)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                    cartMode ? 'bg-primary border-primary text-white' : 'border-border text-muted-foreground hover:text-foreground'
                  }`}>
                  Multi
                </button>
              )}
            </div>
          </DialogHeader>

          <AnimatePresence mode="wait">

            {/* ── Weight prompt overlay ── */}
            {showWeight && selectedTool && (
              <motion.div key="weight" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="space-y-5">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                  <Scale className="w-6 h-6 text-yellow-400 flex-shrink-0"/>
                  <div>
                    <p className="font-black text-foreground">{selectedTool.name}</p>
                    <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest">Sold by weight</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Enter quantity in grams</p>
                  <input autoFocus type="number" min="0" step="0.1" placeholder="e.g. 250"
                    className="w-full bg-input border border-border text-white rounded-xl px-4 py-3 text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary"
                    value={weightInput} onChange={e => setWeightInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmWeight()}/>
                  <p className="text-xs text-muted-foreground text-center">Press Enter or tap Confirm</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowWeight(false); setWeightInput(''); setSelectedTool(null); }}
                    className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-black uppercase text-xs hover:text-white">
                    Cancel
                  </button>
                  <button onClick={confirmWeight} disabled={!weightInput}
                    className="flex-[2] py-3 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110 disabled:opacity-40">
                    Confirm {weightInput ? `${weightInput}g` : ''}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 1: Search / Cart ── */}
            {!showWeight && step === 1 && (
              <motion.div key="step1" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="space-y-4">

                {/* Cart items */}
                {cartMode && cart.length > 0 && (
                  <div className="space-y-2 bg-muted/20 rounded-2xl p-3 border border-border">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cart</p>
                    {cart.map(item => (
                      <div key={item.tool.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{item.tool.name}</p>
                          {item.grams && <p className="text-xs text-yellow-400">{item.grams}g</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setCart(p => p.map(c => c.tool.id===item.tool.id ? {...c,qty:Math.max(1,c.qty-1)} : c))}
                            className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-white">
                            <Minus className="w-3 h-3"/>
                          </button>
                          <span className="text-white font-black text-sm w-5 text-center">{item.qty}</span>
                          <button onClick={() => setCart(p => p.map(c => c.tool.id===item.tool.id ? {...c,qty:c.qty+1} : c))}
                            className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-white">
                            <Plus className="w-3 h-3"/>
                          </button>
                          <button onClick={() => setCart(p => p.filter(c => c.tool.id!==item.tool.id))}
                            className="w-6 h-6 rounded-lg bg-red-900/20 flex items-center justify-center text-red-400 hover:bg-red-900/40">
                            <X className="w-3 h-3"/>
                          </button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setStep(3)}
                      className="w-full mt-2 py-2.5 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110">
                      Checkout {cart.length} item{cart.length!==1?'s':''} →
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-widest">
                  <Zap className="h-4 w-4 animate-pulse"/> Scanner ready — {cartMode ? 'scan multiple items' : 'scan or search'}
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"/>
                  <Input placeholder="Type ID / name / SKU…" autoFocus={!fromScanner}
                    className="pl-12 h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl text-base font-bold"
                    value={search} onChange={e => setSearch(e.target.value)}/>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {filteredTools.map(tool => (
                    <button key={tool.id} onClick={() => selectTool(tool)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50 hover:bg-primary/5 hover:border-primary/30 transition-all group">
                      <div className="h-9 w-9 rounded-lg bg-background flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0">
                        {isWeighted(tool) ? <Scale className="h-4 w-4"/> : <Package className="h-4 w-4"/>}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-white font-bold text-sm truncate">{tool.name}</p>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{tool.id} · {tool.sku}</p>
                      </div>
                      {isWeighted(tool) && <span className="text-[10px] text-yellow-400 font-black uppercase flex-shrink-0">By weight</span>}
                      <Badge className={cn("rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter border-none flex-shrink-0",
                        tool.status==='available'?'bg-green-500/20 text-green-400':
                        tool.status==='checked-out'?'bg-blue-500/20 text-blue-400':'bg-yellow-500/20 text-yellow-400')}>
                        {tool.status}
                      </Badge>
                    </button>
                  ))}
                  {search && filteredTools.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground text-sm italic uppercase tracking-widest">No matching tools</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Action ── */}
            {!showWeight && step === 2 && selectedTool && (
              <motion.div key="step2" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-5">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                    <Package className="h-5 w-5"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black uppercase tracking-tighter truncate">{selectedTool.name}</p>
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">{selectedTool.id} · {selectedTool.location}</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {selectedTool.status==='available' && (
                    <button onClick={()=>{setAction('checkout');setStep(3);}}
                      className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:border-primary/50 transition-all group">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><ArrowUpRight className="h-5 w-5"/></div>
                      <div className="text-left"><p className="text-white font-black uppercase tracking-tighter text-sm">Check Out</p><p className="text-muted-foreground text-[10px] uppercase tracking-widest">Assign to site or vehicle</p></div>
                    </button>
                  )}
                  {selectedTool.status==='checked-out' && (
                    <button onClick={()=>{setAction('return');setStep(3);}}
                      className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:border-green-500/50 transition-all group">
                      <div className="h-10 w-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center"><ArrowDownLeft className="h-5 w-5"/></div>
                      <div className="text-left"><p className="text-white font-black uppercase tracking-tighter text-sm">Return to Shop</p><p className="text-muted-foreground text-[10px] uppercase tracking-widest">Mark as back in warehouse</p></div>
                    </button>
                  )}
                  {selectedTool.status!=='repair' && selectedTool.status!=='disposed' && (
                    <button onClick={()=>{setAction('repair');setStep(3);}}
                      className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:border-yellow-500/50 transition-all group">
                      <div className="h-10 w-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center"><Wrench className="h-5 w-5"/></div>
                      <div className="text-left"><p className="text-white font-black uppercase tracking-tighter text-sm">Log for Repair</p><p className="text-muted-foreground text-[10px] uppercase tracking-widest">Report damage or service needed</p></div>
                    </button>
                  )}
                </div>
                <Button variant="ghost" onClick={()=>setStep(1)} className="w-full text-muted-foreground hover:text-white uppercase font-black tracking-widest text-[10px]">
                  <ArrowLeft className="h-3 w-3 mr-2"/> Back
                </Button>
              </motion.div>
            )}

            {/* ── Step 3: Confirm ── */}
            {!showWeight && step === 3 && (action || cartMode) && (
              <motion.div key="step3" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-6">
                {(action==='checkout' || cartMode) && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Destination</label>
                    <div className="grid grid-cols-3 gap-2">
                      {LOCATIONS.map(loc => (
                        <button key={loc} onClick={()=>setDestination(loc)}
                          className={cn("p-2.5 rounded-xl border font-bold text-xs uppercase tracking-tighter transition-all",
                            destination===loc?"bg-primary border-primary text-white shadow-lg":"bg-card border-border/50 text-muted-foreground hover:border-border")}>
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {action==='repair' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Repair Notes</label>
                    <Textarea placeholder="Describe the issue…" className="bg-background border-border/50 focus:border-yellow-500 min-h-[80px] rounded-xl text-sm"
                      value={notes} onChange={e=>setNotes(e.target.value)}/>
                  </div>
                )}
                {action==='return' && (
                  <div className="p-4 rounded-2xl bg-green-500/5 border border-green-500/20 text-center">
                    <p className="text-green-400 font-bold text-sm">Tool will be returned to Warehouse</p>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  {cartMode ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Checking out {cart.length} items → {destination}</p>
                      {cart.map(item => (
                        <div key={item.tool.id} className="flex items-center justify-between">
                          <span className="text-sm text-foreground truncate">{item.tool.name}</span>
                          <span className="text-xs text-primary font-bold flex-shrink-0 ml-2">
                            {item.grams ? `${item.grams}g` : `×${item.qty}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/20 p-2 rounded-xl text-primary">
                        {action==='checkout'?<ArrowUpRight className="h-5 w-5"/>:action==='return'?<ArrowDownLeft className="h-5 w-5"/>:<Wrench className="h-5 w-5"/>}
                      </div>
                      <div>
                        <p className="text-white font-black uppercase tracking-tighter text-sm">
                          {action==='checkout'?`Check Out → ${destination}`:action==='return'?'Return to Warehouse':'Log for Repair'}
                        </p>
                        <p className="text-primary font-bold text-[10px] uppercase tracking-widest">{selectedTool?.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={()=>cartMode?setStep(1):setStep(2)} className="flex-1 h-12 border-border rounded-xl font-black uppercase tracking-widest text-[10px]">Back</Button>
                  <Button onClick={handleConfirm} className="flex-[2] bg-primary hover:brightness-110 text-white h-12 rounded-xl shadow-2xl shadow-primary/20 font-black uppercase tracking-widest text-[10px]">
                    Confirm & Record
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Step 4: Done ── */}
            {!showWeight && step === 4 && (
              <motion.div key="step4" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center gap-8 py-4 text-center">
                <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 border-4 border-green-500/30">
                  <CheckCircle2 className="h-10 w-10"/>
                </div>
                <div className="space-y-2">
                  <p className="text-white font-black uppercase tracking-tighter text-2xl">Entry Recorded</p>
                  {user?.role==='Staff'
                    ? <p className="text-yellow-400 font-bold text-xs uppercase tracking-widest animate-pulse">Awaiting Partner Approval</p>
                    : <p className="text-green-400 font-bold text-xs uppercase tracking-widest">Signed ✓</p>}
                </div>
                <div className="flex gap-3 w-full">
                  <Button variant="outline" onClick={fullReset} className="flex-1 h-12 border-border rounded-xl font-black uppercase tracking-widest text-[10px]">Scan Another</Button>
                  <Button onClick={()=>handleOpenChange(false)} className="flex-1 bg-primary text-white h-12 rounded-xl font-black uppercase tracking-widest text-[10px]">Done</Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
