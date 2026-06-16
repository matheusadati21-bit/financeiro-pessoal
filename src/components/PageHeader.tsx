import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export const PageHeader = ({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) => (
  <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p className="label">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">{description}</p>
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </motion.header>
);
