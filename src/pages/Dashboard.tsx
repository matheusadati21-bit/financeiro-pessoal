import { useCallback, useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CreditCard, PiggyBank, TrendingUp, WalletCards } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { ChartCard } from '../components/ChartCard';
import { EmptyState } from '../components/EmptyState';
import { api, brl, currentMonth, formatMonth } from '../lib/api';
import { useRealtime } from '../hooks/useRealtime';
import type { Overview } from '../types/finance';

const tooltip = { formatter: (value: any) => brl.format(Number(value || 0)) };

export const Dashboard = () => {
  const [month, setMonth] = useState(currentMonth());
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.get<Overview>(`/api/analytics/overview?month=${month}`);
    setOverview(data);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);
  useRealtime(load);

  if (loading && !overview) return <div className="py-10 text-sm font-bold text-slate-500">Carregando gráficos...</div>;
  if (!overview) return null;

  const expenseData = overview.expenseTrend.map(item => ({ ...item, month: formatMonth(item.month) }));
  const investmentData = overview.investmentTrend.map(item => ({ ...item, month: formatMonth(item.month) }));
  const netWorthData = overview.netWorthHistory.map(item => ({ ...item, month: formatMonth(item.month) }));

  return (
    <div>
      <PageHeader
        eyebrow="visão geral"
        title="Seu dinheiro em tempo real"
        description="Acompanhe gastos, caixinhas, investimentos e evolução patrimonial em um painel só."
      >
        <input className="input max-w-[180px]" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </PageHeader>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Gastos do mês" value={overview.cards.monthlyExpenses} subtitle={`Referência ${formatMonth(month)}`} icon={CreditCard} />
        <StatCard title="Total nas caixinhas" value={overview.cards.boxesBalance} subtitle={`${Math.round((overview.cards.boxesBalance / Math.max(overview.cards.boxesTarget, 1)) * 100)}% dos objetivos`} icon={PiggyBank} />
        <StatCard title="Investimentos" value={overview.cards.investmentsValue} subtitle={`Lucro/prejuízo: ${brl.format(overview.cards.investmentsProfit)}`} icon={TrendingUp} />
        <StatCard title="Patrimônio geral" value={overview.cards.netWorth} subtitle="Último fechamento registrado" icon={WalletCards} trend="Atualiza quando você registra novos dados" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <ChartCard title="Evolução patrimonial" subtitle="Histórico geral calculado a partir dos fechamentos mensais.">
          {netWorthData.length ? (
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f6bff" stopOpacity={0.22}/>
                      <stop offset="95%" stopColor="#0f6bff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(v) => brl.format(Number(v)).replace('R$', '')} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip {...tooltip} />
                  <Area type="monotone" dataKey="total" stroke="#0f6bff" strokeWidth={3} fill="url(#net)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="Sem fechamento mensal" description="Cadastre seu primeiro fechamento na página Patrimônio para o gráfico aparecer." />}
        </ChartCard>

        <ChartCard title="Gastos por categoria" subtitle={`Distribuição em ${formatMonth(month)}.`}>
          {overview.expensesByCategory.length ? (
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overview.expensesByCategory} dataKey="total" nameKey="name" innerRadius={74} outerRadius={118} paddingAngle={4}>
                    {overview.expensesByCategory.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip {...tooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="Sem gastos nesse mês" description="Registre alguns gastos para visualizar a distribuição." />}
        </ChartCard>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <ChartCard title="Gastos nos últimos 12 meses" subtitle="Ajuda a entender meses mais pesados.">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => brl.format(Number(v)).replace('R$', '')} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip {...tooltip} />
                <Bar dataKey="total" fill="#07111f" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Investimentos ao longo do tempo" subtitle="Soma dos últimos registros de cada investimento.">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={investmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => brl.format(Number(v)).replace('R$', '')} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip {...tooltip} />
                <Area type="monotone" dataKey="total" stroke="#16a34a" strokeWidth={3} fill="#16a34a22" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>
    </div>
  );
};
