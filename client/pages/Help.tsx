import { useState } from "react";
import { Layout } from "@/components/Layout";
import { HelpCircle, Zap, BookOpen, Users, ScanLine, ChevronRight } from "lucide-react";

type Section = "quick" | "daily" | "roles" | "scanner";

export default function Help() {
  const [section, setSection] = useState<Section>("quick");

  const tabs: { id: Section; icon: typeof Zap; label: string }[] = [
    { id: "quick",   icon: Zap,      label: "Quick Guide"    },
    { id: "daily",   icon: BookOpen, label: "Daily Workflow" },
    { id: "roles",   icon: Users,    label: "Roles"          },
    { id: "scanner", icon: ScanLine, label: "Scanner"        },
  ];

  const content: Record<Section, React.ReactNode> = {
    quick: (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm leading-relaxed">
          ShopShield is a local-first tool inventory system. Everything is stored on this device — no internet required. Every action is recorded permanently in an immutable audit ledger.
        </p>
        {[
          { title:"Dashboard",    desc:"Live KPI cards — total tools, pending approvals, checked-out, in repair. Action buttons to scan, add tools, adjust ledger, or close the day." },
          { title:"Inventory",    desc:"Full tool registry with search, category and status filters. Log tools for repair or mark repairs complete. Export to CSV." },
          { title:"Audit Ledger", desc:"Immutable append-only log of every action. Staff entries show as Pending until a Partner approves. Corrected entries stay visible at reduced opacity." },
          { title:"Reports",      desc:"Generate Daily Close JSON, Monthly Loss CSV, Maintenance History CSV, and Full Audit Trail CSV. Includes a 7-day activity chart." },
          { title:"Print Tags",   desc:"Select tools and print 48×30mm CODE128 barcode labels on the XPrinter XP-T361U. Preview shows before printing." },
          { title:"Settings",     desc:"Database stats, download JSON backup (USB or cloud), and reset all data (Partner only)." },
          { title:"User Access",  desc:"Partner only — add users, set roles and PINs, deactivate accounts. Demo PINs: Partner=1234, Staff=2345, Tech=3456." },
        ].map(item => (
          <div key={item.title} className="bg-background border border-border rounded-xl p-4">
            <p className="text-foreground font-black text-sm mb-1 flex items-center gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />{item.title}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed pl-5">{item.desc}</p>
          </div>
        ))}
      </div>
    ),

    daily: (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">The dashboard tracks your progress through each step of the daily cycle.</p>
        <div className="space-y-0">
          {[
            { n:"1", color:"bg-primary",     title:"Morning Setup",
              desc:"Log in with PIN. Dashboard shows day as Open (orange sidebar). Scan outgoing tools — the scanner auto-opens the checkout modal. Pick destination (Site A/B/C, Truck A/B, Warehouse) and confirm." },
            { n:"2", color:"bg-blue-600",    title:"During the Day",
              desc:"Scan any tool at any time from any page. Available tools → checkout. Checked-out → return or repair. Staff checkouts show as Pending (yellow pulse on Ledger badge) until approved." },
            { n:"3", color:"bg-yellow-600",  title:"End of Day — Approval",
              desc:"Partner opens Ledger. Review Pending entries — approve individually or tap Approve All. Use Adjust Ledger for any discrepancies (requires partner PIN to authorize)." },
            { n:"4", color:"bg-green-600",   title:"Day Close",
              desc:"Partner clicks Close Day on dashboard. All tools accounted for → Day Closed Clean (green sidebar). Tools missing → mark as Assigned Loss → Day Closed with Assignments (red sidebar)." },
          ].map((item, i, arr) => (
            <div key={item.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full ${item.color} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>{item.n}</div>
                {i < arr.length - 1 && <div className="w-0.5 bg-border flex-1 my-1 min-h-[20px]" />}
              </div>
              <div className="pb-5 pt-0.5 flex-1">
                <p className="text-foreground font-black text-sm">{item.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),

    roles: (
      <div className="space-y-4">
        {[
          { role:"Partner", pin:"1234", color:"border-primary/30 bg-primary/5", tc:"text-primary",
            can:["Full system access","Approve / reject Staff entries","Close the day","Corrective adjustments","Manage users","Export & backup data","Reset data"],
            cannot:["Nothing — full access"] },
          { role:"Staff",   pin:"2345", color:"border-blue-500/20 bg-blue-900/5", tc:"text-blue-400",
            can:["Check tools out","Return tools","Log & complete repairs","View inventory & ledger","Print tags","Export CSV"],
            cannot:["Approve entries","Close day","Corrective adjustments","User management","Settings"] },
          { role:"Tech",    pin:"3456", color:"border-green-500/20 bg-green-900/5", tc:"text-green-400",
            can:["View inventory & ledger","Log tools for repair","Mark repairs complete","Print tags"],
            cannot:["Check out / return tools","Approve entries","Close day","User management","Settings"] },
        ].map(r => (
          <div key={r.role} className={`border rounded-xl p-4 ${r.color}`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`font-black text-sm ${r.tc}`}>{r.role}</p>
              <span className="text-[10px] font-mono text-muted-foreground bg-background/60 px-2 py-1 rounded-lg">Demo PIN: {r.pin}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-green-400 font-black uppercase tracking-widest mb-2 text-[10px]">Can do</p>
                {r.can.map(c => <p key={c} className="text-muted-foreground mb-1">✓ {c}</p>)}
              </div>
              <div>
                <p className="text-red-400 font-black uppercase tracking-widest mb-2 text-[10px]">Cannot</p>
                {r.cannot.map(c => <p key={c} className="text-muted-foreground mb-1">✗ {c}</p>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    ),

    scanner: (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm leading-relaxed">
          USB HID barcode scanners work automatically on every page — no setup needed. The scanner acts like a very fast keyboard.
        </p>
        {[
          { title:"How it's detected",
            desc:"USB scanners type characters at ~5–10ms apart. Humans type at ~300ms per key. ShopShield measures this gap — if all characters arrive faster than 50ms and end with Enter, it's treated as a barcode scan, not manual typing." },
          { title:"What happens when you scan",
            desc:"The scanned code is looked up against the tool ID and SKU fields. If found, the Scan Tool modal opens at the action selection step with the tool pre-loaded. If not found, it opens the search step with the code pre-filled." },
          { title:"Scanning from the Scan Tool button",
            desc:"When you open the Scan Tool modal manually, it shows '⚡ Scanner ready'. Just point the scanner at any tool's barcode — the modal jumps directly to the action step. No typing needed." },
          { title:"Printing barcode labels",
            desc:"Go to Print Tags → select tools → click Print. A new window opens with 48×30mm CODE128 labels and auto-prints. In the print dialog: Scale = 100%, Margins = None. Do not use Fit to page width." },
          { title:"Troubleshooting",
            desc:"Scanner not detected: make sure no text input has focus when scanning from outside a modal. Pop-ups blocked: click the pop-up icon in Firefox's address bar and allow pop-ups for localhost." },
        ].map(item => (
          <div key={item.title} className="bg-background border border-border rounded-xl p-4">
            <p className="text-foreground font-black text-sm mb-1 flex items-center gap-2">
              <ScanLine className="w-3.5 h-3.5 text-primary flex-shrink-0" />{item.title}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    ),
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-7 h-7 text-primary" />
          <h1 className="text-3xl font-black tracking-tighter uppercase text-foreground">Help</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setSection(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                  section === tab.id
                    ? "bg-primary border-primary text-white"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}>
                <Icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          {content[section]}
        </div>

        <p className="text-muted-foreground/40 text-xs text-center">
          ShopShield V1 · Local-first · All data stored on this device
        </p>
      </div>
    </Layout>
  );
}
