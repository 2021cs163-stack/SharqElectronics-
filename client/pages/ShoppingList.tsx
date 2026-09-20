import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { useFinancials, ShoppingItem } from "@/hooks/use-financials";
import { useAuth } from "@/hooks/use-auth";
import { useLedger } from "@/hooks/use-ledger";
import { Plus, X, Check, ShoppingCart, AlertTriangle, Package, Trash2, Calendar } from "lucide-react";

export default function ShoppingList() {
  const { shoppingList, addShoppingItem, markBought, deleteShoppingItem } = useFinancials();
  const { user } = useAuth();
  const { tools } = useLedger();
  const today = new Date();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('General Hardware');
  const [cost, setCost] = useState('');
  const [urgency, setUrgency] = useState<'normal'|'urgent'>('normal');
  const [notes, setNotes] = useState('');
  const [tab, setTab] = useState<'pending'|'bought'>('pending');

  const lowStock = tools.filter(t =>
    t.stock !== undefined && t.lowStockThreshold !== undefined &&
    t.stock <= t.lowStockThreshold
  );

  // Buying day suggestion: Tue/Wed → buy Thu
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysToThursday = dayOfWeek <= 4 ? 4 - dayOfWeek : 11 - dayOfWeek;
  const nextThursday = new Date(today);
  nextThursday.setDate(today.getDate() + daysToThursday);

  const pending = shoppingList.filter(i => !i.bought);
  const bought  = shoppingList.filter(i => i.bought);
  const urgent  = pending.filter(i => i.urgency === 'urgent');

  const handleAdd = () => {
    if (!name.trim()) return;
    addShoppingItem({
      name: name.trim(), category: cat,
      estimatedCost: cost ? parseFloat(cost) : undefined,
      urgency, addedBy: user?.name || '?',
      bought: false, notes: notes.trim() || undefined,
    });
    setName(''); setCat('General Hardware'); setCost(''); setUrgency('normal'); setNotes('');
    setShowAdd(false);
  };

  const inp = "w-full bg-input border border-border text-foreground placeholder:text-muted-foreground rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Layout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase text-foreground">Shopping List</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Items to restock · Next buy: Thu {nextThursday.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-black uppercase text-xs shadow-lg shadow-primary/20 hover:brightness-110">
            <Plus className="w-4 h-4"/> Add Item
          </button>
        </div>

        {/* Urgent alert */}
        {urgent.length > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-900/20 border border-red-700/30">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0"/>
            <div>
              <p className="text-red-400 font-black text-sm">{urgent.length} urgent item{urgent.length!==1?'s':''} needed</p>
              <p className="text-xs text-muted-foreground">{urgent.map(i=>i.name).join(', ')}</p>
            </div>
          </div>
        )}

        {/* Low stock suggestions */}
        {lowStock.length > 0 && (
          <div className="bg-card border border-yellow-700/30 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5"/> Low Stock — Consider Adding to List
            </p>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(t => (
                <button key={t.id}
                  onClick={() => { setName(t.name); setCat(t.category); setShowAdd(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-yellow-900/20 border border-yellow-700/30 text-xs font-bold text-yellow-400 hover:brightness-110">
                  <Package className="w-3 h-3"/> {t.name}

                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-foreground">{pending.length}</p>
            <p className="text-[10px] font-black uppercase text-muted-foreground mt-1">To Buy</p>
          </div>
          <div className="bg-card border border-red-700/30 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-red-400">{urgent.length}</p>
            <p className="text-[10px] font-black uppercase text-muted-foreground mt-1">Urgent</p>
          </div>
          <div className="bg-card border border-green-700/30 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-green-400">{bought.length}</p>
            <p className="text-[10px] font-black uppercase text-muted-foreground mt-1">Bought</p>
          </div>
        </div>

        {/* Tab */}
        <div className="flex bg-card border border-border rounded-xl overflow-hidden w-fit">
          {(['pending','bought'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 text-xs font-black uppercase transition-all ${tab===t?'bg-primary text-white':'text-muted-foreground hover:text-foreground'}`}>
              {t === 'pending' ? `To Buy (${pending.length})` : `Bought (${bought.length})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {(tab === 'pending' ? pending : bought).length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3"/>
              <p className="text-muted-foreground text-sm">{tab==='pending'?'Nothing to buy — great!':'No bought items yet'}</p>
            </div>
          ) : (tab === 'pending' ? pending : bought).map(item => (
            <div key={item.id} className={`flex items-center gap-4 px-5 py-4 border-b border-border/50 last:border-0 ${item.bought?'opacity-60':''}`}>
              {!item.bought && (
                <button onClick={() => markBought(item.id)}
                  className="w-8 h-8 rounded-xl border-2 border-primary/40 flex items-center justify-center hover:bg-primary/10 flex-shrink-0">
                  <Check className="w-4 h-4 text-primary"/>
                </button>
              )}
              {item.bought && (
                <div className="w-8 h-8 rounded-xl bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-green-400"/>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-bold text-sm ${item.bought?'line-through text-muted-foreground':'text-foreground'}`}>{item.name}</p>
                  {item.urgency === 'urgent' && !item.bought && (
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-red-900/40 text-red-400">Urgent</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.category}
                  {item.estimatedCost && ` · ~؋${item.estimatedCost}`}
                  {item.notes && ` · ${item.notes}`}
                  <span className="ml-2 opacity-60">Added by {item.addedBy}</span>
                  {item.bought && item.boughtDate && <span className="ml-2 text-green-400">✓ {item.boughtDate}</span>}
                </p>
              </div>
              <button onClick={() => deleteShoppingItem(item.id)}
                className="p-1.5 text-muted-foreground hover:text-red-400 flex-shrink-0">
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          ))}
        </div>

      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-black uppercase tracking-tighter text-white">Add to Shopping List</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Item Name *</label>
                <input className={`${inp} mt-1`} placeholder="e.g. کندکسر ساده" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</label>
                  <input className={`${inp} mt-1`} placeholder="Category" value={cat} onChange={e=>setCat(e.target.value)}/>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Est. Cost (Af)</label>
                  <input type="number" className={`${inp} mt-1`} placeholder="Optional" value={cost} onChange={e=>setCost(e.target.value)}/>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Priority</label>
                <div className="flex gap-2 mt-1">
                  {(['normal','urgent'] as const).map(u => (
                    <button key={u} onClick={() => setUrgency(u)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-black uppercase transition-all ${
                        urgency===u
                          ? u==='urgent' ? 'bg-red-600 border-red-600 text-white' : 'bg-primary border-primary text-white'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}>{u}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes</label>
                <input className={`${inp} mt-1`} placeholder="Any notes…" value={notes} onChange={e=>setNotes(e.target.value)}/>
              </div>
              <button onClick={handleAdd} disabled={!name.trim()}
                className="w-full py-3 rounded-xl bg-primary text-white font-black uppercase text-xs hover:brightness-110 disabled:opacity-40">
                Add to List
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
