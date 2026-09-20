import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useLedger } from "@/hooks/use-ledger";
import { useBilling } from "@/hooks/use-billing";
import { useShopSettings } from "@/hooks/use-shop-settings";
import { useFinancials } from "@/hooks/use-financials";
import { Link } from "react-router-dom";
import { CheckoutModal } from "@/components/modals/CheckoutModal";
import {
  Receipt, Package, Wrench, Users, Tag, BarChart3,
  AlertTriangle, ChevronRight, ShoppingBag
} from "lucide-react";

export default function Index() {
  const { user } = useAuth();
  const { tools, ledger } = useLedger();
  const { bills } = useBilling();
  const { expenses } = useFinancials();
  const { settings } = useShopSettings();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const sym   = settings.currencySymbol || "؋";

  const todayBills    = bills.filter(b => b.date === today);
  const todayRevenue  = todayBills.reduce((s, b) => s + b.grandTotal, 0);
  const todayExpenses = expenses.filter(e => e.date === today).reduce((s, e) => s + e.amountAf, 0);
  const todayProfit   = todayRevenue - todayExpenses;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStr     = weekStart.toISOString().split("T")[0];
  const weekRevenue = bills.filter(b => b.date >= weekStr).reduce((s, b) => s + b.grandTotal, 0);

  const lowStock = tools.filter(t =>
    t.stock !== undefined && t.lowStockThreshold !== undefined &&
    t.stock <= t.lowStockThreshold
  );
  const pending = ledger.filter(e => e.status === "pending").length;

  const now     = new Date();
  const hour    = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <Layout>
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />

      <div className="space-y-5 max-w-lg mx-auto lg:max-w-none">

        {/* Greeting row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{greeting},</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground">{user?.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {now.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })}
            </p>
          </div>
          <div className="text-right bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">7-Day Revenue</p>
            <p className="text-lg font-black text-foreground mt-0.5">{sym}{weekRevenue.toLocaleString()}</p>
          </div>
        </div>

        {/* Today KPIs — 3 cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sales</p>
            <p className="text-2xl font-black text-primary mt-1">{sym}{todayRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{todayBills.length} bill{todayBills.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expenses</p>
            <p className="text-2xl font-black text-orange-400 mt-1">{sym}{todayExpenses.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">today</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Profit</p>
            <p className={`text-2xl font-black mt-1 ${todayProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
              {sym}{todayProfit.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">today</p>
          </div>
        </div>

        {/* Primary action */}
        <button
          onClick={() => setCheckoutOpen(true)}
          className="w-full h-16 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-lg shadow-xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3">
          <Receipt className="w-7 h-7" /> New Sale
        </button>

        {/* Alerts */}
        {lowStock.length > 0 && (
          <Link to="/inventory" className="flex items-center gap-3 p-4 rounded-2xl bg-red-900/20 border border-red-700/30 hover:border-red-600/50 transition-colors">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-red-400 font-black text-sm">Low Stock — {lowStock.length} item{lowStock.length!==1?"s":""}</p>
              <p className="text-xs text-muted-foreground truncate">
                {lowStock.slice(0, 3).map(t => t.name).join(", ")}{lowStock.length > 3 ? ` +${lowStock.length-3} more` : ""}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </Link>
        )}
        {pending > 0 && (
          <Link to="/ledger" className="flex items-center gap-3 p-4 rounded-2xl bg-yellow-900/20 border border-yellow-700/30 hover:border-yellow-600/50 transition-colors">
            <span className="w-8 h-8 rounded-xl bg-yellow-900/40 flex items-center justify-center text-yellow-400 font-black text-sm flex-shrink-0">{pending}</span>
            <div className="flex-1">
              <p className="text-yellow-400 font-black text-sm">Pending Approvals</p>
              <p className="text-xs text-muted-foreground">Tap to review</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </Link>
        )}

        {/* Today's bills inline */}
        {todayBills.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5" /> Today's Bills
              </p>
              <Link to="/billing" className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-70">
                View All →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {todayBills.slice().reverse().slice(0, 5).map(b => (
                <div key={b.billNo} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{b.customerName}</p>
                    <p className="text-xs text-muted-foreground">{b.billNo} · {b.items.length} item{b.items.length!==1?"s":""}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-primary">{sym}{b.grandTotal.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{b.time}</p>
                  </div>
                </div>
              ))}
              {todayBills.length > 5 && (
                <Link to="/billing" className="block px-5 py-3 text-xs text-primary font-bold text-center hover:bg-primary/5">
                  +{todayBills.length - 5} more bills today →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Quick nav — 3 column grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Inventory",  icon: Package,   to: "/inventory",  color: "text-blue-400" },
            { label: "Billing",    icon: Receipt,   to: "/billing",    color: "text-primary" },
            { label: "Services",   icon: Wrench,    to: "/services",   color: "text-orange-400" },
            { label: "Customers",  icon: Users,     to: "/customers",  color: "text-purple-400" },
            { label: "Print Tags", icon: Tag,       to: "/print-tags", color: "text-yellow-400" },
            { label: "Reports",    icon: BarChart3, to: "/reports",    color: "text-green-400" },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-primary/30 active:scale-95 transition-all text-center">
                <Icon className={`w-5 h-5 ${item.color}`} />
                <span className="font-bold text-foreground text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>

      </div>
    </Layout>
  );
}