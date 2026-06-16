import { FormEvent, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ChartCard } from '../components/ChartCard';
import { EmptyState } from '../components/EmptyState';
import { api, brl, today } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import type { Investment, InvestmentType } from '../types/finance';

const types: { value: InvestmentType; label: string }[] = [
  { value: 'RENDA_FIXA', label: 'Renda fixa' },
  { value: 'RENDA_VARIAVEL', label: 'Renda variável' },
  { value: 'FUNDO', label: 'Fundo' },
  { value: 'CRIPTO', label: 'Cripto' },
  { value: 'PREVIDENCIA', label: 'Previdência' },
  { value: 'OUTRO', label: 'Outro' }
];

const colors = ['#16a34a', '#0f6bff', '#7c3aed', '#f97316', '#0891b2', '#ca8a04'];

export const Investments = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [form, setForm] = useState({ name: '', type: 'RENDA_FIXA' as InvestmentType, institution: '', goal: '', color: colors[0] });
  const [record, setRecord] = useState<Record<string, { date: string; investedAmount: string; currentValue: string; monthlyContribution: string; note: string }>>({});

  const load = useCallback(async () => {
    const data = await api.get<Investment[]>('/api/investments');
    setInvestments(data);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(load);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    await api.post('/api/investments', { ...form, goal: form.goal ? Number(form.goal) : null });
    setForm({ name: '', type: 'RENDA_FIXA', institution: '', goal: '', color: colors[investments.length % colors.length] });
    load();
  };

  const addRecord = async (investment: Investment) => {
    const state = record[investment.id];
    if (!state?.currentValue || !state?.investedAmount) return;
    await api.post(`/api/investments/${investment.id}/records`, {
      ...state,
      investedAmount: Number(state.investedAmount),
      currentValue: Number(state.currentValue),
      monthlyContribution: Number(state.monthlyContribution || 0)
    });
    setRecord((prev) => ({ ...prev, [investment.id]: { date: today(), investedAmount: '', currentValue: '', monthlyContribution: '', note: '' } }));
    load();
  };

  const totalValue = investments.reduce((sum, investment) => sum + investment.latestValue, 0);
  const totalInvested = investments.reduce((sum, investment) => sum + investment.latestInvested, 0);
  const profit = totalValue - totalInvested;

  return (
    <div>
      <PageHeader eyebrow="investimentos" title="Evolução de cada investimento" description="Registre mensalmente o valor investido, o valor atual e os aportes. Cada investimento ganha seu próprio gráfico." />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={create} className="card p-5 sm:p-6">
          <h2 className="text-xl font-black tracking-tight text-ink">Novo investimento</h2>
          <p className="mt-1 text-sm text-slate-500">Ex: Tesouro Selic, CDB, ações, FII, reserva, previdência.</p>
          <div className="mt-5 space-y-4">
            <div><label className="label">Nome</label><input className="input mt-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tesouro, CDB, ações..." required /></div>
            <div><label className="label">Tipo</label><select className="input mt-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as InvestmentType })}>{types.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
            <div><label className="label">Instituição</label><input className="input mt-2" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Banco ou corretora" /></div>
            <div><label className="label">Meta opcional</label><input className="input mt-2" type="number" step="0.01" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="0,00" /></div>
            <div><label className="label">Cor</label><div className="mt-2 flex gap-2">{colors.map(color => <button type="button" key={color} onClick={() => setForm({ ...form, color })} className={`h-9 w-9 rounded-full border-4 ${form.color === color ? 'border-ink' : 'border-white'}`} style={{ background: color }} />)}</div></div>
            <button className="btn-primary w-full"><Plus size={18} /> Criar investimento</button>
          </div>
        </motion.form>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Valor atual</p><strong className="mt-2 block text-3xl font-black text-ink">{brl.format(totalValue)}</strong></div>
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Valor investido</p><strong className="mt-2 block text-3xl font-black text-ink">{brl.format(totalInvested)}</strong></div>
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Resultado</p><strong className={`mt-2 block text-3xl font-black ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{brl.format(profit)}</strong></div>
          </div>

          <section className="grid gap-5">
            {investments.length ? investments.map((investment) => {
              const state = record[investment.id] || { date: today(), investedAmount: investment.latestInvested ? String(investment.latestInvested) : '', currentValue: investment.latestValue ? String(investment.latestValue) : '', monthlyContribution: '', note: '' };
              const chartData = investment.records.map(item => ({ date: item.date.slice(5).split('-').reverse().join('/'), atual: item.currentValue, investido: item.investedAmount }));
              return (
                <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} key={investment.id} className="card p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ background: investment.color }} /><h3 className="text-xl font-black tracking-tight text-ink">{investment.name}</h3></div>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{types.find(t => t.value === investment.type)?.label} {investment.institution ? `• ${investment.institution}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${investment.latestValue - investment.latestInvested >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{brl.format(investment.latestValue - investment.latestInvested)}</span>
                      <button className="btn-danger" onClick={() => api.delete(`/api/investments/${investment.id}`).then(load)}><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Valor atual</p><strong className="mt-1 block text-xl font-black text-ink">{brl.format(investment.latestValue)}</strong></div>
                    <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Investido</p><strong className="mt-1 block text-xl font-black text-ink">{brl.format(investment.latestInvested)}</strong></div>
                    <div className="rounded-3xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Rentabilidade</p><strong className="mt-1 block text-xl font-black text-ink">{investment.profitability}%</strong></div>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
                    <ChartCard title="Gráfico do investimento" subtitle="Valor atual versus valor investido.">
                      {chartData.length ? <div className="h-[260px]"><ResponsiveContainer><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12}/><YAxis tickFormatter={(v) => brl.format(Number(v)).replace('R$', '')} tickLine={false} axisLine={false} fontSize={12}/><Tooltip formatter={(v) => brl.format(Number(v))} /><Area type="monotone" dataKey="atual" stroke={investment.color} strokeWidth={3} fill={`${investment.color}22`} /><Area type="monotone" dataKey="investido" stroke="#64748b" strokeWidth={2} fill="#64748b14" /></AreaChart></ResponsiveContainer></div> : <EmptyState title="Sem registros" description="Adicione o primeiro fechamento mensal deste investimento." />}
                    </ChartCard>

                    <div className="rounded-[28px] bg-slate-50 p-4">
                      <div className="mb-4 flex items-center gap-2 font-black text-ink"><TrendingUp size={18} /> Registrar mês</div>
                      <div className="space-y-3">
                        <input className="input" type="date" value={state.date} onChange={(e) => setRecord({ ...record, [investment.id]: { ...state, date: e.target.value } })} />
                        <input className="input" type="number" step="0.01" value={state.investedAmount} onChange={(e) => setRecord({ ...record, [investment.id]: { ...state, investedAmount: e.target.value } })} placeholder="Total investido" />
                        <input className="input" type="number" step="0.01" value={state.currentValue} onChange={(e) => setRecord({ ...record, [investment.id]: { ...state, currentValue: e.target.value } })} placeholder="Valor atual" />
                        <input className="input" type="number" step="0.01" value={state.monthlyContribution} onChange={(e) => setRecord({ ...record, [investment.id]: { ...state, monthlyContribution: e.target.value } })} placeholder="Aporte do mês" />
                        <button className="btn-primary w-full" onClick={() => addRecord(investment)}><Plus size={16} /> Salvar fechamento</button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            }) : <EmptyState title="Nenhum investimento criado" description="Cadastre seu primeiro investimento e vá registrando o fechamento mensal." />}
          </section>
        </div>
      </div>
    </div>
  );
};
