import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { Boxes } from './pages/Boxes';
import { Investments } from './pages/Investments';
import { NetWorth } from './pages/NetWorth';
import { api } from './lib/api';

const RequireAuth = () => {
  const [state, setState] = useState<'loading' | 'ok' | 'no'>('loading');
  const location = useLocation();

  useEffect(() => {
    api.get('/api/auth/me').then(() => setState('ok')).catch(() => setState('no'));
  }, [location.pathname]);

  if (state === 'loading') return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-slate-500">Carregando seu painel...</div>;
  if (state === 'no') return <Navigate to="/login" replace />;
  return <Shell />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/gastos" element={<Expenses />} />
        <Route path="/caixinhas" element={<Boxes />} />
        <Route path="/investimentos" element={<Investments />} />
        <Route path="/patrimonio" element={<NetWorth />} />
      </Route>
    </Routes>
  );
}
