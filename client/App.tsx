import "./global.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ShopSettingsProvider }  from "./hooks/use-shop-settings";
import { ActivityLogProvider }   from "./hooks/use-activity-log";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { LedgerProvider }        from "./hooks/use-ledger";
import { BillingProvider }       from "./hooks/use-billing";
import { ServicesProvider }      from "./hooks/use-services";
import { FinancialsProvider }    from "./hooks/use-financials";
import { RentalsProvider }      from "./hooks/use-rentals";
import { ProjectsProvider }     from "./hooks/use-projects";

import Rentals          from "./pages/Rentals";
import Projects         from "./pages/Projects";
import ActivityLog      from "./pages/ActivityLog";
import Index            from "./pages/Index";
import Login            from "./pages/Login";
import Inventory        from "./pages/Inventory";
import Ledger           from "./pages/Ledger";
import FinancialLedger  from "./pages/FinancialLedger";
import ImportLedger     from "./pages/ImportLedger";
import ShoppingList     from "./pages/ShoppingList";
import Reports          from "./pages/Reports";
import UserAccess       from "./pages/UserAccess";
import Settings         from "./pages/Settings";
import PrintTags        from "./pages/PrintTags";
import Billing          from "./pages/Billing";
import Services         from "./pages/Services";
import Customers        from "./pages/Customers";
import Help             from "./pages/Help";
import NotFound         from "./pages/NotFound";

import React from 'react';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32, background: '#0f1623', color: '#ef4444',
          minHeight: '100vh', fontFamily: 'monospace'
        }}>
          <h2 style={{color:'#e8621a', marginBottom: 16}}>Sharq Electronics — App Error</h2>
          <p style={{color:'#fff', marginBottom: 8}}>Something crashed. Details below:</p>
          <pre style={{
            background: '#182030', padding: 16, borderRadius: 8,
            color: '#ef4444', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12
          }}>{this.state.error.message}\n\n{this.state.error.stack}</pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{
              marginTop: 24, padding: '12px 24px', background: '#e8621a',
              color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontWeight: 'bold'
            }}
          >Clear Data & Reload</button>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24, marginLeft: 12, padding: '12px 24px', background: '#182030',
              color: '#fff', border: '1px solid #1e2d3d', borderRadius: 8,
              cursor: 'pointer', fontWeight: 'bold'
            }}
          >Just Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}


const queryClient = new QueryClient();

// ── Route guard ───────────────────────────────────────────────────────────────
type AllowedRoles = ("Partner" | "Staff" | "Tech")[];

function Guard({ roles, children }: { roles: AllowedRoles; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── Route shorthand ───────────────────────────────────────────────────────────
const All:     AllowedRoles = ["Partner", "Staff", "Tech"];
const PandT:   AllowedRoles = ["Partner", "Tech"];
const Partner: AllowedRoles = ["Partner"];

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ShopSettingsProvider>
          <AuthProvider>
            <LedgerProvider>
              <BillingProvider>
                <ServicesProvider>
                  <FinancialsProvider>
                    <RentalsProvider>
                    <ProjectsProvider>
                    <ActivityLogProvider>
                      <Toaster />
                      <Sonner />
                      <BrowserRouter>
                        <Routes>
                          {/* Public */}
                          <Route path="/login" element={<Login />} />

                          {/* All roles */}
                          <Route path="/"           element={<Guard roles={All}><Index /></Guard>} />
                          <Route path="/billing"    element={<Guard roles={All}><Billing /></Guard>} />
                          <Route path="/inventory"  element={<Guard roles={All}><Inventory /></Guard>} />
                          <Route path="/services"   element={<Guard roles={All}><Services /></Guard>} />
                          <Route path="/rentals"    element={<Guard roles={All}><Rentals /></Guard>} />
                          <Route path="/projects"   element={<Guard roles={All}><Projects /></Guard>} />
                          <Route path="/customers"  element={<Guard roles={All}><Customers /></Guard>} />
                          <Route path="/print-tags" element={<Guard roles={All}><PrintTags /></Guard>} />
                          <Route path="/help"       element={<Guard roles={All}><Help /></Guard>} />

                          {/* Partner + Tech */}
                          <Route path="/ledger"          element={<Guard roles={PandT}><Ledger /></Guard>} />
                          <Route path="/activity-log"    element={<Guard roles={PandT}><ActivityLog /></Guard>} />

                          {/* Partner only */}
                          <Route path="/financial-ledger" element={<Guard roles={Partner}><FinancialLedger /></Guard>} />
                          <Route path="/shopping"         element={<Guard roles={Partner}><ShoppingList /></Guard>} />
                          <Route path="/import-ledger"    element={<Guard roles={Partner}><ImportLedger /></Guard>} />
                          <Route path="/reports"          element={<Guard roles={Partner}><Reports /></Guard>} />
                          <Route path="/users"            element={<Guard roles={Partner}><UserAccess /></Guard>} />
                          <Route path="/settings"         element={<Guard roles={Partner}><Settings /></Guard>} />

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </BrowserRouter>
                    </ActivityLogProvider>
                    </ProjectsProvider>
                    </RentalsProvider>
                  </FinancialsProvider>
                </ServicesProvider>
              </BillingProvider>
            </LedgerProvider>
          </AuthProvider>
        </ShopSettingsProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
