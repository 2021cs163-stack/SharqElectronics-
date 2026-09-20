import React, { useState, useMemo } from 'react';
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
import { Search, ArrowRight, ArrowLeft, BookOpen, CheckCircle2, ShieldCheck, History, AlertCircle } from 'lucide-react';
import { useLedger, LedgerEntry } from '@/hooks/use-ledger';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { QRApprovalModal } from './QRApprovalModal';

interface AdjustLedgerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdjustLedgerModal({ open, onOpenChange }: AdjustLedgerModalProps) {
  const { ledger, correctiveAdjustment } = useLedger();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [reason, setReason] = useState('');
  const [showQR, setShowQR] = useState(false);

  const filterableLedger = useMemo(() =>
    ledger.filter(e =>
      e.status === 'warning' ||
      e.action === 'Assigned Loss' ||
      e.action === 'Checked Out'
    ), [ledger]);

  const filteredEntries = useMemo(() => {
    if (!search) return filterableLedger.slice(0, 5);
    const s = search.toLowerCase();
    return filterableLedger.filter(e =>
      e.toolName.toLowerCase().includes(s) ||
      e.toolId.toLowerCase().includes(s) ||
      e.userName.toLowerCase().includes(s) ||
      e.id.toLowerCase().includes(s)
    ).slice(0, 5);
  }, [filterableLedger, search]);

  const fullReset = () => {
    setStep(1);
    setSearch('');
    setSelectedEntry(null);
    setReason('');
    setShowQR(false);
  };

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) setTimeout(fullReset, 300);
  };

  const handleQRApproved = () => {
    if (!selectedEntry || !user) return;
    correctiveAdjustment(selectedEntry.id, reason, user);
    setShowQR(false);
    setStep(3);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-card border-border sm:max-w-lg p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-400 border border-yellow-500/20">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">
                    {step === 3 ? 'Correction Applied' : 'Adjust Ledger'}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground font-medium">
                    {step === 1 && 'Select an entry to begin the corrective adjustment process.'}
                    {step === 2 && 'Detail the reason for this adjustment.'}
                    {step === 3 && 'The ledger has been updated with the corrective adjustment.'}
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
                  className="space-y-6"
                >
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="Query entries by tool or ID..."
                      className="pl-12 h-14 bg-background/50 border-border/50 focus:border-yellow-500 rounded-xl text-lg font-bold"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {filterableLedger.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
                      <p className="text-muted-foreground text-sm font-medium">No adjustable entries found.</p>
                      <p className="text-muted-foreground text-xs">Only Checked Out, Assigned Loss, or Warning entries can be corrected.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredEntries.map(entry => (
                        <button
                          key={entry.id}
                          onClick={() => { setSelectedEntry(entry); setStep(2); }}
                          className="w-full flex items-center justify-between p-4 rounded-xl border border-border/30 bg-card/50 hover:bg-yellow-500/5 hover:border-yellow-500/30 transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center text-muted-foreground group-hover:text-yellow-400 group-hover:bg-yellow-500/10 transition-colors">
                              <BookOpen className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                              <p className="text-white font-bold text-sm leading-tight">{entry.toolName}</p>
                              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{entry.action} · {entry.id}</p>
                            </div>
                          </div>
                          <Badge className={cn(
                            'rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter border-none',
                            entry.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                            entry.status === 'signed'  ? 'bg-green-500/20 text-green-400'   :
                                                         'bg-red-500/20 text-red-400'
                          )}>
                            {entry.status}
                          </Badge>
                        </button>
                      ))}
                      {search && filteredEntries.length === 0 && (
                        <p className="text-center py-8 text-muted-foreground text-sm italic uppercase tracking-widest">No matching entries</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 2 && selectedEntry && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-3 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-yellow-400 tracking-[0.2em]">Selected Entry</p>
                      <span className="text-[10px] font-black uppercase text-muted-foreground">{selectedEntry.timestamp} · {selectedEntry.date}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                        <History className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-white font-black uppercase tracking-tighter text-lg leading-none mb-1">{selectedEntry.toolName}</p>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{selectedEntry.action} by {selectedEntry.userName}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Adjustment Reason *</label>
                    <Textarea
                      required
                      placeholder="Why is this corrective adjustment being performed? Detail the error found..."
                      className="bg-background/50 border-border/50 focus:border-yellow-500 min-h-[120px] rounded-xl font-medium text-sm"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1 h-14 border-border rounded-xl font-black uppercase tracking-widest text-[10px]"
                    >
                      <ArrowLeft className="h-3 w-3 mr-2" /> Back
                    </Button>
                    <Button
                      disabled={!reason.trim()}
                      onClick={() => setShowQR(true)}
                      className="flex-[2] bg-yellow-500 hover:bg-yellow-400 text-black h-14 rounded-xl shadow-2xl shadow-yellow-500/20 font-black uppercase tracking-widest text-[10px]"
                    >
                      Authorize via QR <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-10 py-6 text-center"
                >
                  <div className="h-24 w-24 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 border-4 border-green-500/30">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-white font-black uppercase tracking-tighter text-2xl leading-none">Adjustment Signed</p>
                      <p className="text-green-400 font-bold text-xs uppercase tracking-widest">Original entry marked as Corrected</p>
                    </div>
                    <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-green-400 shrink-0" />
                      <p className="text-[10px] text-left font-medium text-muted-foreground leading-relaxed italic">
                        The corrective adjustment has been cryptographically signed and the inventory state has been restored.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleOpenChange(false)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-14 rounded-xl font-black uppercase tracking-widest text-[10px]"
                  >
                    Done
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
        title="Authorize Adjustment"
        description="Partner signature required for ledger corrective action."
        onApproved={handleQRApproved}
      />
    </>
  );
}
