import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, CreditCard, Gem, Home, LogOut, PiggyBank, TrendingUp, WalletCards } from 'lucide-react';
import { api } from '../lib/api';

const items = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/gastos', label: 'Gastos', icon: CreditCard },
  { to: '/caixinhas', label: 'Caixinhas', icon: PiggyBank },
  { to: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { to: '/patrimonio', label: 'Patrimônio', icon: WalletCards }
];

export const Shell = () => {
  const navigate = useNavigate();
  const logout = async () => {
    await api.post('/api/auth/logout');
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[290px] p-4 lg:block">
        <div className="glass flex h-full flex-col rounded-[32px] p-4 shadow-soft">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white shadow-glow"><Gem /></div>
            <div>
              <strong className="block text-lg font-black tracking-tight text-ink">Meu Financeiro</strong>
              <span className="text-xs font-semibold text-slate-500">Controle pessoal premium</span>
            </div>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-2">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${isActive ? 'bg-ink text-white shadow-glow' : 'text-slate-600 hover:bg-white hover:text-ink'}`}>
                <Icon size={20} /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="rounded-3xl bg-slate-900 p-4 text-white">
            <BarChart3 className="mb-3" />
            <p className="text-sm font-bold">Registre todo mês.</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">Os gráficos ficam mais inteligentes conforme você alimenta os dados.</p>
          </div>

          <button onClick={logout} className="mt-3 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-red-50 hover:text-red-600">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:ml-[290px] lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <nav className="fixed bottom-3 left-3 right-3 z-50 grid grid-cols-5 rounded-[28px] border border-white/70 bg-white/90 p-2 shadow-soft backdrop-blur-xl lg:hidden">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold transition ${isActive ? 'bg-ink text-white' : 'text-slate-500'}`}>
            <Icon size={19} /> <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
