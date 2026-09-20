import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Boxes, 
  History, 
  BarChart3, 
  Users, 
  Settings,
  ShieldCheck
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Boxes, label: "Inventory", path: "/inventory" },
  { icon: History, label: "Ledger", path: "/ledger" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Users, label: "User Access", path: "/user-access" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function Navigation() {
  const location = useLocation();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r glass-card p-4 lg:flex lg:flex-col shadow-2xl shadow-primary/5">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/30 btn-hover-effect">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter text-sidebar-foreground">SHOPSHIELD</span>
            <span className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase opacity-80">Industrial</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300 btn-hover-effect",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-sidebar-foreground/60 hover:bg-primary/5 hover:text-primary"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "group-hover:text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl bg-muted/50 p-5 border border-border/50">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">System Health</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-muted-foreground">Uptime</span>
              <span className="text-green-600">99.9%</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-[99%]" />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Secure Connection
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t bg-background px-4 lg:hidden">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
