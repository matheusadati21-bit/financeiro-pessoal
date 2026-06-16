import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { brl } from '../lib/api';

interface Props {
  title: string;
  value: number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
}

export const StatCard = ({ title, value, subtitle, icon: Icon, trend }: Props) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4 }}
    className="card p-5 sm:p-6"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        <strong className="mt-2 block text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{brl.format(value || 0)}</strong>
        {subtitle && <span className="mt-2 block text-sm text-slate-500">{subtitle}</span>}
      </div>
      <div className="rounded-2xl bg-slate-100 p-3 text-ink">
        <Icon size={22} />
      </div>
    </div>
    {trend && <div className="mt-4 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{trend}</div>}
  </motion.div>
);
