import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ChartCard } from '../components/ChartCard';
import { EmptyState } from '../components/EmptyState';
import { api, brl, currentMonth } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import type { Expense, ExpenseCategory, ExpenseType } from '../types/finance';

const expenseTypes: { value: ExpenseType; label: string }[] = [
  { value: 'VARIABLE', label: 'Variável' },
  { value: 'FIXED', label: 'Fixo' },
  { value: 'CARD', label: 'Cartão' },
  { value: 'SUBSCRIPTION', label: 'Assinatura' }
];

export const Expenses = () => {
  const [month, setMonth] = useState(currentMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().slice(0, 10), type: 'VARIABLE' as ExpenseType, categoryId: '', payment: 'Conta principal', notes: '' });
  const [newCategory, setNewCategory] = useState('');

  const load = useCallback(async () => {
    const [expenseData, categoryData] = await Promise.all([
      api.get<Expense[]>(`/api/expenses?month=${month}`),
      api.get<ExpenseCategory[]>('/api/expense-categories')
    ]);
    setExpenses(expenseData);
    setCategories(categoryData);
    if (!form.categoryId && categoryData[0]) setForm((f) => ({ ...f, categoryId: categoryData[0].id }));
  }, [month, form.categoryId]);

  useEffect(() => { load(); }, [load]);
  useRealtime(load);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api.post('/api/expenses', { ...form, amount: Number(form.amount) });
    setForm((f) => ({ ...f, description: '', amount: '', notes: '' }));
    load();
  };

  const createCategory = async () => {
    if (!newCategory.trim()) return;
    const colors = ['#0f6bff', '#16a34a', '#f97316', '#7c3aed', '#dc2626', '#0891b2'];
    const category = await api.post<ExpenseCategory>('/api/expense-categories', { name: newCategory.trim(), color: colors[categories.length % colors.length] });
    setNewCategory('');
    setForm((f) => ({ ...f, categoryId: category.id }));
    load();
  };

  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const byCategory = useMemo(() => categories.map((cat) => ({
    name: cat.name,
    total: expenses.filter((expense) => expense.categoryId === cat.id).reduce((sum, expense) => sum + expense.amount, 0),
    color: cat.color
  })).filter(item => item.total > 0), [categories, expenses]);

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((expense) => map.set(expense.date.slice(8, 10), (map.get(expense.date.slice(8, 10)) || 0) + expense.amount));
    return Array.from(map.entries()).sort(([a], [b]) => Number(a) - Number(b)).map(([day, total]) => ({ day, total }));
  }, [expenses]);

  return (
    <div>
      <PageHeader eyebrow="gastos" title="Controle o que está saindo" description="Registre despesas por mês, categoria, forma de pagamento e veja para onde seu dinheiro está indo.">
        <input className="input max-w-[180px]" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="card p-5 sm:p-6">
          <h2 className="text-xl font-black tracking-tight text-ink">Novo gasto</h2>
          <p className="mt-1 text-sm text-slate-500">Quanto mais simples registrar, mais fácil manter o controle.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label">Descrição</label>
              <input className="input mt-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: mercado, gasolina, iFood" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Valor</label>
                <input className="input mt-2" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" required />
              </div>
              <div>
                <label className="label">Data</label>
                <input className="input mt-2" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input mt-2" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                {categories.map((cat) => <option value={cat.id} key={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input className="input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Criar nova categoria" />
              <button type="button" onClick={createCategory} className="btn-soft"><Plus size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select className="input mt-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ExpenseType })}>
                  {expenseTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Pagamento</label>
                <input className="input mt-2" value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Observação</label>
              <textarea className="input mt-2 min-h-[88px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" />
            </div>
            <button className="btn-primary w-full"><Plus size={18} /> Registrar gasto</button>
          </div>
        </motion.form>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Total do mês</p><strong className="mt-2 block text-3xl font-black text-ink">{brl.format(total)}</strong></div>
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Maior categoria</p><strong className="mt-2 block text-xl font-black text-ink">{byCategory[0]?.name || 'Sem dados'}</strong></div>
            <div className="card p-5"><p className="text-sm font-bold text-slate-500">Registros</p><strong className="mt-2 block text-3xl font-black text-ink">{expenses.length}</strong></div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="Por categoria" subtitle="Veja o peso de cada área no mês.">
              {byCategory.length ? <div className="h-[280px]"><ResponsiveContainer><PieChart><Pie data={byCategory} dataKey="total" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={4}>{byCategory.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(v) => brl.format(Number(v))} /></PieChart></ResponsiveContainer></div> : <EmptyState title="Sem dados" description="Cadastre gastos para ver o gráfico." />}
            </ChartCard>

            <ChartCard title="Gastos por dia" subtitle="Identifique picos de saída no mês.">
              {daily.length ? <div className="h-[280px]"><ResponsiveContainer><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12}/><YAxis tickFormatter={(v) => brl.format(Number(v)).replace('R$', '')} tickLine={false} axisLine={false} fontSize={12}/><Tooltip formatter={(v) => brl.format(Number(v))} /><Bar dataKey="total" fill="#07111f" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="Sem dados" description="O gráfico aparece conforme você lança gastos." />}
            </ChartCard>
          </div>

          <section className="card overflow-hidden p-4 sm:p-6">
            <h2 className="text-lg font-black text-ink">Lançamentos</h2>
            <div className="mt-4 space-y-3">
              {expenses.length ? expenses.map(expense => (
                <div key={expense.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-ink">{expense.description}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{expense.date.split('-').reverse().join('/')} • {expense.category?.name} • {expense.payment}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong className="whitespace-nowrap text-sm font-black text-ink sm:text-base">{brl.format(expense.amount)}</strong>
                    <button className="btn-danger" onClick={() => api.delete(`/api/expenses/${expense.id}`).then(load)}><Trash2 size={16} /></button>
                  </div>
                </div>
              )) : <EmptyState title="Nenhum gasto lançado" description="Comece registrando o primeiro gasto deste mês." />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
