import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  History, 
  Clock, 
  Package, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { useLedger } from '@/hooks/use-ledger';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { QRApprovalModal } from './QRApprovalModal';

interface ApproveDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApproveDayModal({ open, onOpenChange }: ApproveDayModalProps) {
  const { tools, ledger, closeDayClean, closeDayWithAssignments } = useLedger();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [qrAction, setQrAction] = useState<'clean' | 'assignments' | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntries = ledger.filter(e => e.date === todayStr);
  const pendingCount = ledger.filter(e => e.status === 'pending').length;
  const stillOutTools = tools.filter(t => t.status === 'checked-out');

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) {
      setTimeout(() => {
        setStep(1);
        setSelectedAssignments([]);
        setShowQR(false);
        setQrAction(null);
      }, 300);
    }
  };

  const startQR = (action: 'clean' | 'assignments') => {
    setQrAction(action);
    setShowQR(true);
  };

  const handleQRApproved = () => {
    if (!user) return;
    setShowQR(false);
    if (qrAction === 'clean') {
      closeDayClean(user);
    } else if (qrAction === 'assignments') {
      closeDayWithAssignments(selectedAssignments, user);
    }
    setStep(3); // Done step
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-card border-border sm:max-w-2xl p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-success/10 p-2 rounded-lg text-success border border-success/20">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">
                    {step === 1 && "Daily Integrity Review"}
                    {step === 2 && "Loss Assignment Matrix"}
                    {step === 3 && "Daily Operations Synchronized"}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground font-medium">
                    {step === 1 && "Validate today's ledger and account for checked-out equipment."}
                    {step === 2 && "Select equipment to be logged as Assigned Loss before closing."}
                    {step === 3 && "All entries have been cryptographically signed and day state locked."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  key="step1" 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-background/50 border border-border/50 p-6 rounded-2xl space-y-2">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Today's Entries</p>
                      <p className="text-3xl font-black text-white">{todayEntries.length}</p>
                    </div>
                    <div className={cn(
                      "border p-6 rounded-2xl space-y-2",
                      pendingCount > 0 ? "bg-warning/5 border-warning/30" : "bg-background/50 border-border/50"
                    )}>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pending Logs</p>
                      <p className={cn("text-3xl font-black", pendingCount > 0 ? "text-warning animate-pulse" : "text-white")}>
                        {pendingCount}
                      </p>
                    </div>
                    <div className={cn(
                      "border p-6 rounded-2xl space-y-2",
                      stillOutTools.length > 0 ? "bg-destructive/5 border-destructive/30" : "bg-background/50 border-border/50"
                    )}>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tools Still Out</p>
                      <p className={cn("text-3xl font-black", stillOutTools.length > 0 ? "text-destructive" : "text-white")}>
                        {stillOutTools.length}
                      </p>
                    </div>
                  </div>

                  {stillOutTools.length > 0 && (
                    <div className="bg-destructive/10 border-2 border-destructive/20 rounded-[2rem] p-8 space-y-6">
                      <div className="flex items-center gap-4 text-destructive">
                        <AlertTriangle className="h-8 w-8" />
                        <div>
                          <p className="font-black uppercase tracking-tighter text-xl leading-none">Equipment Accountancy Breach</p>
                          <p className="text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Physical inventory does not match ledger state</p>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                        {stillOutTools.map(t => (
                          <div key={t.id} className="flex items-center justify-between py-2 border-b border-destructive/10 last:border-0">
                            <span className="text-white font-bold text-sm">{t.name}</span>
                            <Badge className="bg-destructive text-white border-none text-[8px] font-black uppercase tracking-widest px-2">{t.id}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {user?.role !== 'Partner' ? (
                    <div className="bg-card border-2 border-dashed border-border rounded-2xl p-6 text-center">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">Day Closing Requires Partner Clearance</p>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <Button 
                        disabled={pendingCount > 0 || stillOutTools.length > 0}
                        onClick={() => startQR('clean')}
                        className="flex-1 h-20 flex-col items-center justify-center gap-1 bg-success hover:bg-success/90 text-white rounded-2xl shadow-xl shadow-success/20 font-black uppercase tracking-widest text-[10px]"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        Close Day — Clean
                      </Button>
                      <Button 
                        onClick={() => setStep(2)}
                        className="flex-1 h-20 flex-col items-center justify-center gap-1 border-2 border-destructive/50 hover:bg-destructive/10 text-destructive rounded-2xl font-black uppercase tracking-widest text-[10px]"
                      >
                        <AlertTriangle className="h-5 w-5" />
                        Close Day — Adjust
                      </Button>
                    </div>
                  )}
                  
                  {pendingCount > 0 && (
                    <p className="text-center text-[10px] font-bold text-warning uppercase tracking-widest">
                      * All pending entries must be signed before day closure
                    </p>
                  )}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2" 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Select items to mark as Assigned Loss</label>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {stillOutTools.map(t => (
                        <div 
                          key={t.id}
                          onClick={() => {
                            if (selectedAssignments.includes(t.id)) {
                              setSelectedAssignments(selectedAssignments.filter(id => id !== t.id));
                            } else {
                              setSelectedAssignments([...selectedAssignments, t.id]);
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer",
                            selectedAssignments.includes(t.id) ? "border-destructive bg-destructive/5 shadow-lg shadow-destructive/10" : "bg-card border-border/50 hover:border-border"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <Checkbox 
                              checked={selectedAssignments.includes(t.id)} 
                              onCheckedChange={() => {}} // Controlled by div click
                              className="border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:text-white"
                            />
                            <div>
                              <p className="text-white font-black uppercase tracking-tighter text-sm leading-none mb-1">{t.name}</p>
                              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">{t.id} · {t.location}</p>
                            </div>
                          </div>
                          <p className="text-white font-black text-sm">${t.costPrice.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <p className="text-white font-black uppercase tracking-tighter leading-none mb-1">Total Adjustment Value</p>
                      <p className="text-destructive font-bold text-[10px] uppercase tracking-widest italic">Loss to be recorded in ledger</p>
                    </div>
                    <p className="text-2xl font-black text-destructive">
                      ${selectedAssignments.reduce((sum, id) => sum + (tools.find(t => t.id === id)?.costPrice || 0), 0).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setStep(1)}
                      className="flex-1 h-14 border-border rounded-xl font-black uppercase tracking-widest text-[10px]"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <Button 
                      onClick={() => startQR('assignments')}
                      className="flex-[2] bg-destructive hover:bg-destructive/90 text-white h-14 rounded-xl shadow-2xl shadow-destructive/20 font-black uppercase tracking-widest text-[10px]"
                    >
                      Continue with QR Approval <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3" 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-10 py-10 text-center"
                >
                  <div className="h-32 w-32 bg-success/20 rounded-full flex items-center justify-center text-success border-4 border-success/30 shadow-2xl shadow-success/20">
                    <CheckCircle2 className="h-16 w-16" />
                  </div>
                  
                  <div className="space-y-4 px-10">
                    <div className="space-y-1">
                      <p className="text-white font-black uppercase tracking-tighter text-4xl leading-none">Day Locked</p>
                      <p className="text-success font-bold text-xs uppercase tracking-widest">Cryptographic chain synchronized</p>
                    </div>
                    <p className="text-muted-foreground text-sm font-medium leading-relaxed italic">
                      The current operations day has been officially closed and recorded in the ShopShield immutable ledger. All pending entries have been finalized.
                    </p>
                  </div>

                  <Button 
                    onClick={() => handleOpenChange(false)}
                    className="w-full max-w-sm bg-success hover:bg-success/90 text-white h-16 rounded-2xl shadow-2xl shadow-success/20 font-black uppercase tracking-widest text-xs"
                  >
                    Return to Dashboard
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      <QRApprovalModal 
        open={showQR} 
        onOpenChange={setShowQR} 
        title="Sign Daily Closure" 
        description="Partner authorization required to commit day state to ledger."
        onApproved={handleQRApproved}
      />
    </>
  );
}
