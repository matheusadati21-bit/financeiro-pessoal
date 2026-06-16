import { FormEvent, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Trash2, WalletCards } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ChartCard } from '../components/ChartCard';
import { EmptyState } from '../components/EmptyState';
import { api, brl, today } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import type { NetWorthSnapshot } from '../types/finance';

export const NetWorth = () => {
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [form, setForm] = useState({ date: today(), cash: '', otherAssets: '', liabilities: '', note: '' });

  const load = useCallback(async () => {
    const data = await api.get<NetWorthSnapshot[]>('/api/net-worth-snapshots');
    setSnapshots(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(load);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api.post('/api/net-worth-snapshots', {
      date: form.date,
      cash: Number(form.cash || 0),
      otherAssets: Number(form.otherAssets || 0),
      liabilities: Number(form.liabilities || 0),
      note: form.note
    });
    setForm({ date: today(), cash: '', otherAssets: '', liabilities: '', note: '' });
    load();
  };

  const latest = snapshots.at(-1);
  const previous = snapshots.at(-2);
  const diff = latest && previous ? latest.total - previous.total : 0;
  const chartData = snapshots.map(item => ({
    date: item.date.slice(5).split('-').reverse().join('/'),
    total: item.total,
    investimentos: item.investments,
    caixinhas: item.boxes,
    liquido: item.cash + item.otherAssets - item.liabilities
  }));

  return (
    <div>
      <PageHeader eyebrow="patrimônio" title="Fechamento mensal patrimonial" description="Registre o saldo em conta, bens fora dos investimentos e dívidas. O sistema soma isso com investimentos e caixinhas para mostrar seu patrimônio geral no tempo." />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="card p-5 sm:p-6">
          <h2 className="text-xl font-black tracking-tight text-ink">Novo fechamento</h2>
          <p className="mt-1 text-sm text-slate-500">Faça esse registro uma vez por mês para acompanhar a evolução real.</p>
          <div className="mt-5 space-y-4">
            <div><label className="label">Data do fechamento</label><input className="input mt-2" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div><label className="label">Saldo em contas</label><input className="input mt-2" type="number" step="0.01" value={form.cash} onChange={(e) => setForm({ ...form, cash: e.target.value })} placeholder="Conta corrente, bancos, carteira" /></div>
            <div><label className="label">Outros bens</label><input className="input mt-2" type="number" step="0.01" value={form.otherAssets} onChange={(e) => setForm({ ...form, otherAssets: e.target.value })} placeholder="Bens, valores fora de bancos" /></div>
            <div><label className="label">Dívidas</label><input className="input mt-2" type="number" step="0.01" value={form.liabilities} onChange={(e) => setForm({ ...form, liabilities: e.target.value })} placeholder="Cartão, empréstimos, financiamentos" /></div>
            <div><label className="label">Observação</label><textarea className="input mt-2 min-h-[88px]" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex: mês com compra grande, aporte extra..." /></div>
            <button className="btn-primary w-full"><Plus size={18} /> Salvar fechamento</button>
          </div>
        </motion.form>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Patrimônio atual</p><strong className="mt-2 block text-3xl font-black text-ink">{brl.format(latest?.total || 0)}</strong></div>
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Variação</p><strong className={`mt-2 block text-3xl font-black ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{brl.format(diff)}</strong></div>
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Fechamentos</p><strong className="mt-2 block text-3xl font-black text-ink">{snapshots.length}</strong></div>
          </div>

          <ChartCard title="Patrimônio geral por tempo" subtitle="Linha principal do seu crescimento patrimonial.">
            {chartData.length ? <div className="h-[360px]"><ResponsiveContainer><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12}/><YAxis tickFormatter={(v) => brl.format(Number(v)).replace('R$', '')} tickLine={false} axisLine={false} fontSize={12}/><Tooltip formatter={(v) => brl.format(Number(v))} /><Area type="monotone" dataKey="total" stroke="#0f6bff" strokeWidth={3} fill="#0f6bff22" /><Area type="monotone" dataKey="investimentos" stroke="#16a34a" strokeWidth={2} fill="#16a34a12" /><Area type="monotone" dataKey="caixinhas" stroke="#f97316" strokeWidth={2} fill="#f9731612" /></AreaChart></ResponsiveContainer></div> : <EmptyState title="Sem histórico" description="Registre seu primeiro fechamento para ver o gráfico patrimonial." />}
          </ChartCard>

          <section className="card p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2"><WalletCards /><h2 className="text-lg font-black text-ink">Histórico de fechamentos</h2></div>
            <div className="space-y-3">
              {snapshots.length ? snapshots.slice().reverse().map(item => (
                <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink">{item.date.split('-').reverse().join('/')} • {brl.format(item.total)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Contas: {brl.format(item.cash)} • Outros: {brl.format(item.otherAssets)} • Investimentos: {brl.format(item.investments)} • Caixinhas: {brl.format(item.boxes)} • Dívidas: {brl.format(item.liabilities)}</p>
                      {item.note && <p className="mt-2 text-sm text-slate-500">{item.note}</p>}
                    </div>
                    <button className="btn-danger" onClick={() => api.delete(`/api/net-worth-snapshots/${item.id}`).then(load)}><Trash2 size={16} /></button>
                  </div>
                </div>
              )) : <EmptyState title="Nenhum fechamento salvo" description="Registre o fechamento deste mês para iniciar a linha patrimonial." />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
