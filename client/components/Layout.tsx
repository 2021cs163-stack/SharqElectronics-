import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useShopSettings } from '@/hooks/use-shop-settings';
import { useLedger } from '@/hooks/use-ledger';
import { useScanner } from '@/hooks/use-scanner';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ScanToolModal } from './modals/ScanToolModal';
import { TechEditBar } from './TechEditBar';
import { motion, AnimatePresence } from 'framer-motion';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { settings: shopTheme } = useShopSettings();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', shopTheme.theme || 'dark');
  }, [shopTheme.theme]);
  const { tools } = useLedger();
  const navigate = useNavigate();
  const location = useLocation();
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scannedToolId, setScannedToolId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [user, location.pathname, navigate]);

  // Global USB scanner intercept — fires on any page
  useScanner({
    enabled: !!user && location.pathname !== '/login',
    onScan: (code) => {
      // Try exact ID match first, then SKU match
      const tool = tools.find(t =>
        t.id.toLowerCase() === code.toLowerCase() ||
        t.sku.toLowerCase() === code.toLowerCase()
      );
      if (tool) {
        setScannedToolId(tool.id);
        setScanModalOpen(true);
      } else {
        // Unknown code — open modal with the raw code as search
        setScannedToolId(code);
        setScanModalOpen(true);
      }
    },
  });

  if (!user && location.pathname !== '/login') return null;

  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col pb-24 lg:pb-0">
        <main className="flex-1 p-4 lg:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileNav />

      <TechEditBar />
      {/* Global scan modal — triggered by USB scanner from any page */}
      <ScanToolModal
        open={scanModalOpen}
        onOpenChange={(open) => {
          setScanModalOpen(open);
          if (!open) setScannedToolId(undefined);
        }}
        initialToolId={scannedToolId}
      />
    </div>
  );
}
