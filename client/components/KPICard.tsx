import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface KPICardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color: string;
}

export function KPICard({ label, value, icon: Icon, trend, color }: KPICardProps) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-xl hover:shadow-primary/5"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <h2 className="text-3xl font-bold tracking-tight">{value}</h2>
        </div>
        <div className={`rounded-xl ${color} p-3 text-white shadow-lg`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            {trend}
          </span>
          <span className="text-xs text-muted-foreground">vs last month</span>
        </div>
      )}
      
      {/* Decorative accent */}
      <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-primary/5 opacity-20" />
    </motion.div>
  );
}
