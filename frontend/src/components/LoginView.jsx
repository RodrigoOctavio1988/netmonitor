import React, { useState } from 'react';
import { Activity, Lock, User, ShieldCheck, Eye, EyeOff, Sparkles, Server, ArrowRight } from 'lucide-react';

export default function LoginView({ apiUrl, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e, customUser, customPass) => {
    if (e) e.preventDefault();
    const u = customUser !== undefined ? customUser : username;
    const p = customPass !== undefined ? customPass : password;

    if (!u || !p) {
      setError('Por favor, preencha o usuário e a senha.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Credenciais inválidas. Tente novamente.');
        setIsLoading(false);
        return;
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError('Não foi possível conectar ao servidor de autenticação.');
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    if (role === 'admin') {
      setUsername('admin');
      setPassword('admin123');
      handleLogin(null, 'admin', 'admin123');
    } else {
      setUsername('operador');
      setPassword('operador123');
      handleLogin(null, 'operador', 'operador123');
    }
  };

  return (
    <div className="min-h-screen bg-main flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Cabeçalho de Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-4 transform hover:scale-105 transition-transform duration-300">
            <Activity className="h-8 w-8 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-display font-bold text-adaptive-primary tracking-tight">NetMonitor</h1>
          <p className="text-sm text-adaptive-secondary mt-1 font-sans">
            Plataforma de Monitoramento de Rede e Controle de Acesso
          </p>
        </div>

        {/* Card de Login Glassmorphic */}
        <div className="glass-panel p-8 rounded-3xl border border-adaptive-border shadow-2xl relative">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-adaptive-border">
            <h2 className="text-lg font-display font-semibold text-adaptive-primary flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-400" />
              Autenticação de Usuário
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              v3.0 JWT
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-3 animate-tab-enter">
              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-adaptive-secondary uppercase tracking-wider mb-2">
                Usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Seu usuário..."
                  className="w-full pl-10 pr-4 py-3 glass-input rounded-xl placeholder:text-slate-400 font-sans text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-adaptive-secondary uppercase tracking-wider mb-2">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha..."
                  className="w-full pl-10 pr-10 py-3 glass-input rounded-xl placeholder:text-slate-400 font-sans text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-adaptive-tertiary hover:text-adaptive-primary"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Seção de Acesso Rápido / Demonstração */}
          <div className="mt-8 pt-6 border-t border-adaptive-border">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold text-adaptive-secondary uppercase tracking-wider">
                Acesso Rápido de Demonstração (RBAC):
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl text-left transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-blue-400 flex items-center justify-between mb-1">
                  <span>Administrador</span>
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div className="text-[11px] text-adaptive-secondary">Acesso Total (CRUD)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('operator')}
                className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-left transition-colors group cursor-pointer"
              >
                <div className="text-xs font-bold text-emerald-400 flex items-center justify-between mb-1">
                  <span>Operador</span>
                  <Server className="h-3.5 w-3.5" />
                </div>
                <div className="text-[11px] text-adaptive-secondary">Leitura / Dashboard</div>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-adaptive-tertiary mt-6">
          &copy; {new Date().getFullYear()} NetMonitor. Autenticação via JSON Web Tokens.
        </p>
      </div>
    </div>
  );
}
