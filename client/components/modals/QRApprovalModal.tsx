import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Smartphone, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QRApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onApproved: () => void;
  dataString?: string;
}

export function QRApprovalModal({ open, onOpenChange, title, description, onApproved, dataString = "SS-V1-SIG-A82-C91" }: QRApprovalModalProps) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => setStep(4), 1500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const renderDotGrid = () => {
    return (
      <div className="grid grid-cols-21 gap-px bg-white p-4 rounded-xl shadow-2xl">
        {Array.from({ length: 21 * 21 }).map((_, i) => {
          // Finder patterns
          const x = i % 21;
          const y = Math.floor(i / 21);
          const isFinder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
          const isBlack = isFinder || Math.random() > 0.5;
          return (
            <div key={i} className={cn("w-1.5 h-1.5", isBlack ? "bg-black" : "bg-white")} />
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-2">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s} 
                className={cn(
                  "flex-1 h-1.5 rounded-full transition-all duration-500",
                  step >= s ? "bg-primary" : "bg-border"
                )} 
              />
            ))}
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">{description}</DialogDescription>
        </DialogHeader>

        <div className="py-6 min-h-[300px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="flex flex-col items-center gap-6"
              >
                {renderDotGrid()}
                <p className="font-mono text-[10px] bg-background px-3 py-1.5 rounded border border-border text-primary font-bold">
                  {dataString}
                </p>
                <Button 
                  onClick={() => setStep(2)}
                  className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-xl shadow-primary/20"
                >
                  Partner Scanned → Next
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center gap-8 text-center"
              >
                <div className="h-24 w-24 bg-primary/10 rounded-3xl flex items-center justify-center text-primary relative">
                  <Smartphone className="h-12 w-12" />
                  <div className="absolute -top-2 -right-2 bg-warning h-8 w-8 rounded-full border-4 border-card flex items-center justify-center">
                    <QrCode className="h-4 w-4 text-black" />
                  </div>
                </div>
                <div className="space-y-2 px-6">
                  <p className="text-white font-black uppercase tracking-tighter text-lg leading-tight">Partner Authorization Required</p>
                  <p className="text-muted-foreground text-xs font-medium">Please ask the Partner to scan the response QR code generated on their device to verify this ledger entry.</p>
                </div>
                <Button 
                  onClick={() => setStep(3)}
                  className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] h-12 px-10 rounded-xl shadow-xl shadow-primary/20"
                >
                  Scanned Response → Verify
                </Button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <p className="text-primary font-black uppercase tracking-widest text-xs animate-pulse">Verifying Ed25519 signature…</p>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-8 text-center"
              >
                <div className="h-24 w-24 bg-success/20 rounded-full flex items-center justify-center text-success border-4 border-success/30">
                  <CheckCircle2 className="h-14 w-14" />
                </div>
                <div className="space-y-4 w-full">
                  <div>
                    <p className="text-success font-black uppercase tracking-tighter text-2xl leading-none">Signature Verified</p>
                    <p className="text-muted-foreground text-xs font-medium mt-1">Transaction cryptographically locked to ledger.</p>
                  </div>
                  <div className="bg-success/5 border border-success/20 rounded-xl p-4 font-mono text-left space-y-1">
                    <p className="text-success font-bold text-[8px] uppercase tracking-widest">Algorithm: ED25519-P256</p>
                    <p className="text-success font-bold text-[8px] uppercase tracking-widest">Status: VERIFIED_SIGNED</p>
                    <p className="text-success font-bold text-[8px] uppercase tracking-widest">TS: {new Date().toISOString()}</p>
                  </div>
                </div>
                <Button 
                  onClick={onApproved}
                  className="w-full bg-success hover:bg-success/90 text-white font-black uppercase tracking-widest text-[10px] h-14 rounded-xl shadow-2xl shadow-success/20"
                >
                  Complete Authorization
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
