import { FormEvent, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ChartCard } from '../components/ChartCard';
import { EmptyState } from '../components/EmptyState';
import { api, brl, today } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import type { BoxEntryType, SavingBox } from '../types/finance';

const colors = ['#0f6bff', '#16a34a', '#f97316', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04'];

export const Boxes = () => {
  const [boxes, setBoxes] = useState<SavingBox[]>([]);
  const [form, setForm] = useState({ name: '', description: '', target: '', deadline: '', color: colors[0] });
  const [entry, setEntry] = useState<Record<string, { type: BoxEntryType; amount: string; date: string; note: string }>>({});

  const load = useCallback(async () => {
    const data = await api.get<SavingBox[]>('/api/boxes');
    setBoxes(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(load);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    await api.post('/api/boxes', { ...form, target: Number(form.target), deadline: form.deadline || null });
    setForm({ name: '', description: '', target: '', deadline: '', color: colors[boxes.length % colors.length] });
    load();
  };

  const addEntry = async (boxId: string) => {
    const data = entry[boxId];
    if (!data?.amount) return;
    await api.post(`/api/boxes/${boxId}/entries`, { ...data, amount: Number(data.amount) });
    setEntry((prev) => ({ ...prev, [boxId]: { type: 'DEPOSIT', amount: '', date: today(), note: '' } }));
    load();
  };

  const totalBalance = boxes.reduce((sum, box) => sum + box.balance, 0);
  const totalTarget = boxes.reduce((sum, box) => sum + box.target, 0);
  const chartData = boxes.filter(box => box.balance > 0).map(box => ({ name: box.name, value: box.balance, color: box.color }));

  return (
    <div>
      <PageHeader eyebrow="caixinhas" title="Para o que você está juntando" description="Crie objetivos, acompanhe o valor guardado, movimente entradas e saídas e veja o progresso de cada meta." />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={create} className="card p-5 sm:p-6">
          <h2 className="text-xl font-black tracking-tight text-ink">Nova caixinha</h2>
          <p className="mt-1 text-sm text-slate-500">Ex: viagem, reserva, carro, apartamento, equipamentos.</p>
          <div className="mt-5 space-y-4">
            <div><label className="label">Nome</label><input className="input mt-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Viagem, reserva, casa..." required /></div>
            <div><label className="label">Objetivo em R$</label><input className="input mt-2" type="number" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="0,00" required /></div>
            <div><label className="label">Prazo</label><input className="input mt-2" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
            <div><label className="label">Descrição</label><textarea className="input mt-2 min-h-[92px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Por que esse objetivo importa?" /></div>
            <div><label className="label">Cor</label><div className="mt-2 flex gap-2">{colors.map(color => <button type="button" key={color} onClick={() => setForm({ ...form, color })} className={`h-9 w-9 rounded-full border-4 ${form.color === color ? 'border-ink' : 'border-white'}`} style={{ background: color }} />)}</div></div>
            <button className="btn-primary w-full"><Plus size={18} /> Criar caixinha</button>
          </div>
        </motion.form>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Guardado</p><strong className="mt-2 block text-3xl font-black text-ink">{brl.format(totalBalance)}</strong></div>
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Objetivos</p><strong className="mt-2 block text-3xl font-black text-ink">{brl.format(totalTarget)}</strong></div>
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Progresso geral</p><strong className="mt-2 block text-3xl font-black text-ink">{Math.round((totalBalance / Math.max(totalTarget, 1)) * 100)}%</strong></div>
          </div>

          <ChartCard title="Distribuição das caixinhas" subtitle="Quanto existe guardado em cada objetivo.">
            {chartData.length ? <div className="h-[280px]"><ResponsiveContainer><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={106} paddingAngle={4}>{chartData.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(v) => brl.format(Number(v))} /></PieChart></ResponsiveContainer></div> : <EmptyState title="Sem valores guardados" description="Adicione entradas nas caixinhas para visualizar o gráfico." />}
          </ChartCard>

          <section className="grid gap-5 lg:grid-cols-2">
            {boxes.length ? boxes.map((box) => {
              const state = entry[box.id] || { type: 'DEPOSIT', amount: '', date: today(), note: '' };
              return (
                <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} key={box.id} className="card overflow-hidden p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-ink">{box.name}</h3>
                      {box.description && <p className="mt-1 text-sm text-slate-500">{box.description}</p>}
                      {box.deadline && <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"><CalendarDays size={14} /> até {box.deadline.split('-').reverse().join('/')}</span>}
                    </div>
                    <button className="btn-danger" onClick={() => api.delete(`/api/boxes/${box.id}`).then(load)}><Trash2 size={16} /></button>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm font-bold"><span>{brl.format(box.balance)}</span><span className="text-slate-500">{brl.format(box.target)}</span></div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, box.progress)}%`, background: box.color }} /></div>
                    <p className="mt-2 text-xs font-bold text-slate-500">{Math.round(box.progress)}% concluído</p>
                  </div>

                  <div className="mt-5 rounded-3xl bg-slate-50 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <select className="input" value={state.type} onChange={(e) => setEntry({ ...entry, [box.id]: { ...state, type: e.target.value as BoxEntryType } })}><option value="DEPOSIT">Entrada</option><option value="WITHDRAW">Saída</option></select>
                      <input className="input" type="number" step="0.01" value={state.amount} onChange={(e) => setEntry({ ...entry, [box.id]: { ...state, amount: e.target.value } })} placeholder="Valor" />
                      <input className="input" type="date" value={state.date} onChange={(e) => setEntry({ ...entry, [box.id]: { ...state, date: e.target.value } })} />
                      <button className="btn-primary" onClick={() => addEntry(box.id)}><Plus size={16} /> Lançar</button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {box.entries.slice(0, 4).map(item => <div key={item.id} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm"><span className={item.type === 'DEPOSIT' ? 'font-bold text-green-600' : 'font-bold text-red-600'}>{item.type === 'DEPOSIT' ? '+' : '-'} {brl.format(item.amount)}</span><span className="text-xs font-semibold text-slate-400">{item.date.split('-').reverse().join('/')}</span></div>)}
                  </div>
                </motion.article>
              );
            }) : <div className="lg:col-span-2"><EmptyState title="Nenhuma caixinha criada" description="Crie sua primeira meta para começar a acompanhar seus objetivos." /></div>}
          </section>
        </div>
      </div>
    </div>
  );
};
