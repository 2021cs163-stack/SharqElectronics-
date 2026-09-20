import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, BookOpen, BarChart3, Users, Settings,
  HelpCircle, LogOut, Tag, Receipt, Wrench, UserCircle, FolderKanban,
  History, ShoppingCart, DollarSign, Zap, AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLedger } from '@/hooks/use-ledger';
import { useBilling } from '@/hooks/use-billing';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { ledger } = useLedger();
  const { bills } = useBilling();
  const navigate = useNavigate();

  const pendingCount  = ledger.filter(e => e.status === 'pending').length;
  const creditCount   = bills.filter(b => b.status === 'credit').length;
  const isPartner = user?.role === 'Partner';
  const isTech    = user?.role === 'Tech';
  const isStaff   = user?.role === 'Staff';

  type NavItem = { label: string; icon: any; path: string; badge?: number; badgeColor?: string };
  type NavGroup = { label: string; items: NavItem[] };

  const navGroups: NavGroup[] = [
    {
      label: 'Main',
      items: [
        { label: 'Dashboard',   icon: LayoutDashboard, path: '/' },
        { label: 'New Sale',    icon: Receipt,         path: '/billing',
          badge: creditCount > 0 ? creditCount : undefined, badgeColor: 'bg-orange-500' },
        { label: 'Inventory',   icon: Package,         path: '/inventory' },
        { label: 'Services',    icon: Wrench,          path: '/services' },
        { label: 'Rentals',     icon: Package,         path: '/rentals' },
        { label: 'Projects',    icon: FolderKanban,    path: '/projects' },
        { label: 'Customers',   icon: UserCircle,      path: '/customers' },
      ]
    },
    // Finance group — Partner only
    ...(!isStaff && !isTech ? [{
      label: 'Finance',
      items: [
        { label: 'Fin. Ledger', icon: DollarSign,  path: '/financial-ledger' },
        { label: 'Reports',     icon: BarChart3,    path: '/reports' },
        { label: 'Shopping',    icon: ShoppingCart, path: '/shopping' },
      ] as NavItem[]
    }] : []),
    {
      label: 'Operations',
      items: [
        { label: 'Print Tags',  icon: Tag,       path: '/print-tags' },
        ...(!isStaff ? [
          { label: 'Audit Log', icon: BookOpen,  path: '/ledger',
            badge: pendingCount || undefined, badgeColor: 'bg-yellow-400 text-black' },
          { label: 'Activity',  icon: History,   path: '/activity-log' },
        ] as NavItem[] : []),
      ]
    },
    {
      label: 'Admin',
      items: [
        ...(isPartner ? [
          { label: 'Users',    icon: Users,     path: '/users' },
          { label: 'Settings', icon: Settings,  path: '/settings' },
        ] as NavItem[] : []),
        { label: 'Help', icon: HelpCircle, path: '/help' },
      ]
    },
  ].filter(g => g.items.length > 0);

  return (
    <div className="hidden lg:flex flex-col w-56 bg-sidebar border-r border-border h-screen sticky top-0 overflow-y-auto">
      {/* Brand */}
      <div className="p-5 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-primary p-2 rounded-xl">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-black uppercase tracking-tight text-base leading-none">Sharq</h1>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Electronics</p>
          </div>
        </div>
        {/* Role badge */}
        <div className={cn(
          "mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
          isPartner ? "bg-primary/20 text-primary" :
          isTech    ? "bg-green-900/40 text-green-400" :
                      "bg-blue-900/40 text-blue-400"
        )}>
          {isPartner ? "👑 Partner" : isTech ? "🔧 Tech" : "👤 Staff"}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-3 space-y-4">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 px-3 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => cn(
                    "flex items-center justify-between px-3 py-3 rounded-xl transition-all text-sm",
                    isActive
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:bg-card hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium tracking-wide">{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={cn(
                      "h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center text-[10px] font-black",
                      item.badgeColor || "bg-yellow-400 text-black"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border/50">
        <div className="flex items-center gap-2.5 p-2 bg-card/50 rounded-2xl border border-border/30">
          <Avatar className="h-8 w-8 border-2 border-primary/20 flex-shrink-0">
            <AvatarFallback className="bg-slate-900 text-primary font-black uppercase text-xs">
              {user?.name.split(' ').map(n => n[0]).join('').slice(0,2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-xs truncate">{user?.name}</p>
            <p className="text-[9px] font-black uppercase text-primary tracking-widest">{user?.role}</p>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="p-1.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors rounded-lg flex-shrink-0">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
