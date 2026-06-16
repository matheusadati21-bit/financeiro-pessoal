import { Sparkles } from 'lucide-react';

export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
    <div className="mb-4 rounded-2xl bg-white p-4 text-blue-600 shadow-sm"><Sparkles /></div>
    <h3 className="text-lg font-extrabold text-ink">{title}</h3>
    <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
  </div>
);
