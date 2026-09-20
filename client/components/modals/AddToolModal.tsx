import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Plus, CheckCircle2, Package, Tag, DollarSign, MapPin, Calendar, FileText } from 'lucide-react';
import { useLedger } from '@/hooks/use-ledger';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = ["Power Tools", "Hand Tools", "Saws", "Safety Gear", "Test Equipment", "Consumables", "Electrical", "Other"];
const LOCATIONS = ["Warehouse", "Site A", "Site B", "Site C", "Truck A", "Truck B"];

interface AddToolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToolModal({ open, onOpenChange }: AddToolModalProps) {
  const { addTool } = useLedger();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    costPrice: "",
    minSellPrice: "",
    maxSellPrice: "",
    category: "Other",
    location: "Warehouse",
    calibrationDue: "",
    notes: "",
    unit: "piece",
    stock: "",
    lowStockThreshold: "",
    cupboardNo: "",
    shelf: "",
    packSize: "",
    packUnit: "piece",
    isRental: false,
    rentalRateHour: "",
    rentalRateDay: "",
    rentalRateWeek: "",
    rentalCurrency: "Af",
  });
  const [isSuccess, setIsSuccess] = useState(false);

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) {
      setTimeout(() => {
        setIsSuccess(false);
        setFormData({ name: "", sku: "", costPrice: "", minSellPrice: "", maxSellPrice: "", category: "Other", location: "Warehouse", calibrationDue: "", notes: "", unit: "piece", stock: "", lowStockThreshold: "", cupboardNo: "", shelf: "", packSize: "", packUnit: "piece", isRental: false, rentalRateHour: "", rentalRateDay: "", rentalRateWeek: "", rentalCurrency: "Af" });
      }, 300);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    addTool({
      ...formData,
      costPrice: parseFloat(formData.costPrice) || 0,
      minSellPrice: parseFloat(formData.minSellPrice) || undefined,
      maxSellPrice: parseFloat(formData.maxSellPrice) || undefined,
      unit: formData.unit || "piece",
      stock: formData.stock !== "" ? parseFloat(formData.stock) : undefined,
      lowStockThreshold: formData.lowStockThreshold !== "" ? parseFloat(formData.lowStockThreshold) : undefined,
      cupboardNo: formData.cupboardNo || undefined,
      shelf: formData.shelf || undefined,
      packSize: formData.packSize !== "" ? parseFloat(formData.packSize) : undefined,
      packUnit: formData.packUnit || undefined,
      isRental: formData.isRental,
      rentalRateHour: formData.rentalRateHour !== "" ? parseFloat(formData.rentalRateHour) : undefined,
      rentalRateDay: formData.rentalRateDay !== "" ? parseFloat(formData.rentalRateDay) : undefined,
      rentalRateWeek: formData.rentalRateWeek !== "" ? parseFloat(formData.rentalRateWeek) : undefined,
      rentalCurrency: formData.rentalCurrency || "Af",
    }, user);

    setIsSuccess(true);
  };

  const reset = () => {
    setIsSuccess(false);
    setFormData({ name: "", sku: "", costPrice: "", minSellPrice: "", maxSellPrice: "", category: "Other", location: "Warehouse", calibrationDue: "", notes: "", unit: "piece", stock: "", lowStockThreshold: "", cupboardNo: "", shelf: "", packSize: "", packUnit: "piece", isRental: false, rentalRateHour: "", rentalRateDay: "", rentalRateWeek: "", rentalCurrency: "Af" });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-xl p-0 overflow-hidden">
        <div className="p-8">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-primary/10 p-2 rounded-lg text-primary border border-primary/20">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">
                  {isSuccess ? "Asset Registered" : "Register New Asset"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground font-medium">
                  {isSuccess ? "New equipment has been provisioned into the system." : "Initialize a new equipment node in the ShopShield CORE network."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {!isSuccess ? (
              <motion.form 
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSubmit} 
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      <Package className="h-3 w-3 text-primary" /> Tool Name *
                    </label>
                    <Input 
                      required
                      placeholder="e.g. DeWalt 20V MAX XR Drill"
                      className="h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl font-bold"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      <Tag className="h-3 w-3 text-primary" /> SKU / Tag ID *
                    </label>
                    <Input 
                      required
                      placeholder="DW-DRILL-001"
                      className="h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl font-bold"
                      value={formData.sku}
                      onChange={e => setFormData({...formData, sku: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      <DollarSign className="h-3 w-3 text-primary" /> Cost Price ($) *
                    </label>
                    <Input 
                      required
                      type="number"
                      step="0.01"
                      placeholder="199.99"
                      className="h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl font-bold"
                      value={formData.costPrice}
                      onChange={e => setFormData({...formData, costPrice: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      Price Range (Min / Max Sell)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" step="0.01" placeholder="Min sell price"
                        className="h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl font-bold"
                        value={formData.minSellPrice}
                        onChange={e => setFormData({...formData, minSellPrice: e.target.value})} />
                      <Input type="number" step="0.01" placeholder="Max sell price"
                        className="h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl font-bold"
                        value={formData.maxSellPrice}
                        onChange={e => setFormData({...formData, maxSellPrice: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      <MapPin className="h-3 w-3 text-primary" /> Initial Location
                    </label>
                    <Select 
                      value={formData.location} 
                      onValueChange={v => setFormData({...formData, location: v})}
                    >
                      <SelectTrigger className="h-12 bg-background/50 border-border/50 rounded-xl font-bold">
                        <SelectValue placeholder="Select Location" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {LOCATIONS.map(loc => (
                          <SelectItem key={loc} value={loc} className="font-bold text-xs uppercase tracking-tighter">{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      Unit of Measure
                    </label>
                    <Select value={formData.unit||"piece"} onValueChange={v => setFormData({...formData, unit: v})}>
                      <SelectTrigger className="h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl">
                        <SelectValue/>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="piece">Piece / Each</SelectItem>
                        <SelectItem value="meter">Meter (m)</SelectItem>
                        <SelectItem value="foot">Foot (ft)</SelectItem>
                        <SelectItem value="kg">Kilogram (kg)</SelectItem>
                        <SelectItem value="gram">Gram (g)</SelectItem>
                        <SelectItem value="liter">Liter (L)</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="roll">Roll</SelectItem>
                        <SelectItem value="set">Set</SelectItem>
                        <SelectItem value="pair">Pair</SelectItem>
                        <SelectItem value="dozen">Dozen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      Stock in Store
                    </label>
                    <Input
                      type="number" min="0" step="0.1"
                      placeholder={`Qty (${formData.unit||'pieces'})`}
                      className="h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl font-bold"
                      value={formData.stock}
                      onChange={e => setFormData({...formData, stock: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      Low Stock Alert At
                    </label>
                    <Input
                      type="number" min="0" step="0.1"
                      placeholder="e.g. 5"
                      className="h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl font-bold"
                      value={formData.lowStockThreshold}
                      onChange={e => setFormData({...formData, lowStockThreshold: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      <Calendar className="h-3 w-3 text-primary" /> Calibration Due
                    </label>
                    <Input 
                      type="date"
                      className="h-12 bg-background/50 border-border/50 focus:border-primary rounded-xl font-bold"
                      value={formData.calibrationDue}
                      onChange={e => setFormData({...formData, calibrationDue: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                      <FileText className="h-3 w-3 text-primary" /> Initial Notes
                    </label>
                    <Textarea 
                      placeholder="Additional specs or conditions..."
                      className="bg-background/50 border-border/50 focus:border-primary min-h-[80px] rounded-xl font-medium text-sm"
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                </div>

                {/* Storage location */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Cupboard No</label>
                    <Input className="mt-1" placeholder="e.g. C-3" value={formData.cupboardNo}
                      onChange={e=>setFormData(p=>({...p,cupboardNo:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Shelf</label>
                    <Input className="mt-1" placeholder="e.g. Top" value={formData.shelf}
                      onChange={e=>setFormData(p=>({...p,shelf:e.target.value}))}/>
                  </div>
                </div>

                {/* Pack / bulk */}
                <div className="pt-2 border-t border-border space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Pack / Bulk Sale (optional)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Items per pack</label>
                      <Input className="mt-1" type="number" min="1" placeholder="e.g. 100" value={formData.packSize}
                        onChange={e=>setFormData(p=>({...p,packSize:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Unit per item</label>
                      <Input className="mt-1" placeholder="meter / gram" value={formData.packUnit}
                        onChange={e=>setFormData(p=>({...p,packUnit:e.target.value}))}/>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Scanning will ask how many units to sell and reduce stock.</p>
                </div>

                {/* Rental */}
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={()=>setFormData(p=>({...p,isRental:!p.isRental}))}
                      className={`w-10 h-5 rounded-full transition-all flex items-center px-0.5 ${formData.isRental?"bg-primary":"bg-muted"}`}>
                      <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isRental?"translate-x-5":"translate-x-0"}`}/>
                    </button>
                    <label className="text-xs font-semibold text-foreground">Available for Rent</label>
                  </div>
                  {formData.isRental && (
                    <div className="grid grid-cols-3 gap-2">
                      {([["rentalRateHour","Per Hour"],["rentalRateDay","Per Day"],["rentalRateWeek","Per Week"]] as [string,string][]).map(([k,l])=>(
                        <div key={k}>
                          <label className="text-[11px] text-muted-foreground">{l}</label>
                          <Input className="mt-1" type="number" min="0" placeholder="0" value={(formData as any)[k]}
                            onChange={e=>setFormData(p=>({...p,[k]:e.target.value}))}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => handleOpenChange(false)}
                    className="flex-1 h-14 border-border rounded-xl font-black uppercase tracking-widest text-[10px]"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    className="flex-[2] bg-primary hover:bg-primary/90 text-white h-14 rounded-xl shadow-2xl shadow-primary/20 font-black uppercase tracking-widest text-[10px]"
                  >
                    Register Asset
                  </Button>
                </div>
              </motion.form>
            ) : (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-10 py-6 text-center"
              >
                <div className="h-24 w-24 bg-success/20 rounded-full flex items-center justify-center text-success border-4 border-success/30">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-white font-black uppercase tracking-tighter text-2xl leading-none">Tool Added</p>
                    <p className="text-success font-bold text-xs uppercase tracking-widest">Entry recorded in local database</p>
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground max-w-xs mx-auto leading-relaxed italic">
                    The equipment has been successfully initialized and assigned a unique ID in the ShopShield immutable ledger.
                  </p>
                </div>

                <div className="flex gap-4 w-full">
                  <Button 
                    variant="outline" 
                    onClick={reset}
                    className="flex-1 h-14 border-border rounded-xl font-black uppercase tracking-widest text-[10px]"
                  >
                    Add Another
                  </Button>
                  <Button 
                    onClick={() => handleOpenChange(false)}
                    className="flex-1 bg-primary text-white h-14 rounded-xl shadow-2xl shadow-primary/20 font-black uppercase tracking-widest text-[10px]"
                  >
                    Done
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
