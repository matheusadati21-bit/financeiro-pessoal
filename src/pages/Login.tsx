import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, LockKeyhole, WalletCards } from 'lucide-react';
import { api } from '../lib/api';

export const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/api/auth/login', { email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid w-full max-w-5xl overflow-hidden rounded-[36px] bg-white shadow-soft lg:grid-cols-[1.1fr_.9fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden bg-ink p-10 text-white lg:block">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="absolute bottom-20 left-8 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3"><WalletCards /></div>
              <span className="font-black tracking-tight">Meu Financeiro</span>
            </div>
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-blue-200">pessoal, privado e completo</p>
              <h1 className="text-5xl font-black tracking-[-0.055em]">Sua vida financeira em um painel bonito.</h1>
              <p className="mt-5 max-w-md leading-7 text-slate-300">Gastos, caixinhas, objetivos, investimentos e evolução patrimonial com gráficos em tempo real.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['Gastos', 'Caixinhas', 'Patrimônio'].map((item) => <div key={item} className="rounded-3xl bg-white/10 p-4 text-sm font-bold backdrop-blur">{item}</div>)}
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mb-10 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700"><LockKeyhole /></div>
          <h2 className="text-3xl font-black tracking-[-0.04em] text-ink">Entrar no painel</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Use o e-mail e senha que você configurar no EasyPanel.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input className="input mt-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@email.com" required />
            </div>
            <div>
              <label className="label">Senha</label>
              <input className="input mt-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" required />
            </div>
            {error && <div className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</div>}
            <button disabled={loading} className="btn-primary w-full">
              {loading ? 'Entrando...' : 'Entrar'} <ArrowRight size={18} />
            </button>
          </form>
        </section>
      </motion.div>
    </main>
  );
};
