import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, Receipt, DollarSign,
  BarChart3, Wrench, HelpCircle, FolderKanban
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const { user } = useAuth();
  const isPartner = user?.role === 'Partner';
  const isStaff   = user?.role === 'Staff';

  // 5 items max for mobile bottom nav — role-aware
  const navItems = isPartner ? [
    { label: 'Home',    icon: LayoutDashboard, path: '/' },
    { label: 'Sale',    icon: Receipt,         path: '/billing' },
    { label: 'Stock',   icon: Package,         path: '/inventory' },
    { label: 'Ledger',  icon: DollarSign,      path: '/financial-ledger' },
    { label: 'Reports', icon: BarChart3,        path: '/reports' },
  ] : isStaff ? [
    { label: 'Home',    icon: LayoutDashboard, path: '/' },
    { label: 'Sale',    icon: Receipt,         path: '/billing' },
    { label: 'Stock',   icon: Package,         path: '/inventory' },
    { label: 'Service', icon: Wrench,          path: '/services' },
    { label: 'Rentals',  icon: Package,         path: '/rentals' },
    { label: 'Projects', icon: FolderKanban,    path: '/projects' },
    { label: 'Help',    icon: HelpCircle,      path: '/help' },
  ] : [
    // Tech
    { label: 'Home',    icon: LayoutDashboard, path: '/' },
    { label: 'Sale',    icon: Receipt,         path: '/billing' },
    { label: 'Stock',   icon: Package,         path: '/inventory' },
    { label: 'Service', icon: Wrench,          path: '/services' },
    { label: 'Rentals',  icon: Package,         path: '/rentals' },
    { label: 'Projects', icon: FolderKanban,    path: '/projects' },
    { label: 'Help',    icon: HelpCircle,      path: '/help' },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-sidebar/95 backdrop-blur-lg border-t border-border z-50 h-16 px-1">
      <div className="flex items-center justify-around h-full">
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-xl transition-all",
              isActive ? "text-primary" : "text-muted-foreground hover:text-white"
            )}>
            <item.icon className="h-5 w-5"/>
            <span className="text-[9px] font-black uppercase tracking-wide">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
