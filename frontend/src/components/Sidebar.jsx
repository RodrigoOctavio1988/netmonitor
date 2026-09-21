/**
 * Sidebar.jsx — Navegação lateral com suporte a Perfis de Autenticação (RBAC) e Logout
 */
import React from 'react';
import { Activity, Wifi, WifiOff, ScanLine, Sun, Moon, X, Bell, BarChart3, Search, HelpCircle, User, LogOut, ShieldCheck, Server, Info } from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  wsStatus,
  theme,
  onToggleTheme,
  isMobileOpen,
  onCloseMobile,
  unreadAlerts = 0,
  onOpenCommandPalette,
  onOpenHelpModal,
  onOpenAboutModal,
  user,
  onLogout
}) {
  const menuItems = [
    { id: 'dashboard',  label: 'Monitoramento',   icon: Activity  },
    { id: 'scanner',    label: 'Varredura de IP',  icon: ScanLine  },
    { id: 'analytics',  label: 'Analytics',        icon: BarChart3 },
    {
      id:    'alerts',
      label: 'Alertas',
      icon:  Bell,
      badge: unreadAlerts > 0 ? unreadAlerts : null
    },
    {
      id:     'about',
      label:  'Sobre',
      icon:   Info,
      action: onOpenAboutModal
    },
  ];

  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* Backdrop overlay para mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 glass-panel border-r border-adaptive-border flex flex-col h-screen fixed left-0 top-0 z-40 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-adaptive-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/30">
              <Activity className="h-6 w-6 text-blue-400 animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-adaptive-primary tracking-wide">NetMonitor</h1>
              <span className="text-[10px] text-adaptive-secondary font-mono">v3.0.0</span>
            </div>
          </div>
          {/* Botão de fechar apenas em mobile */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-adaptive-secondary hover:text-adaptive-primary rounded-lg hover:bg-slate-800/40"
            title="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Badge Info Card */}
        {user && (
          <div className="px-4 py-3 border-b border-adaptive-border bg-slate-500/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                isAdmin ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <Server className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-adaptive-primary truncate">{user.name || user.username}</div>
                <div className="flex items-center gap-1">
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                    isAdmin ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {isAdmin ? 'ADMIN' : 'OPERADOR'}
                  </span>
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-adaptive-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Sair do Sistema (Logout)"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Connection Status Badge */}
        <div className="px-6 py-3 border-b border-adaptive-border">
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium border ${
            wsStatus === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {wsStatus === 'connected' ? (
              <>
                <Wifi className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>Conectado ao Servidor</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-rose-400" />
                <span>Desconectado</span>
              </>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-4 space-y-1.5">
          {menuItems.map((item) => {
            const Icon     = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else {
                    setActiveTab(item.id);
                  }
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-500/10'
                }`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-adaptive-secondary'}`} />
                <span className="flex-1 text-left">{item.label}</span>

                {/* Badge de alertas não lidos */}
                {item.badge && (
                  <span className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[10px] font-bold rounded-full shadow-lg ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-500 text-white shadow-rose-500/30'
                  }`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Info & Theme Toggle */}
        <div className="p-4 border-t border-adaptive-border mt-auto bg-slate-500/5 flex items-center justify-between gap-1">
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-500/10 border border-adaptive-border transition-all"
            title="Busca Rápida (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-mono text-[10px]">Ctrl+K</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenHelpModal}
              title="Atalhos de Teclado (?)"
              className="p-2 rounded-xl text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-500/10 border border-adaptive-border transition-all"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
              className="p-2 rounded-xl text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-500/10 border border-adaptive-border transition-all"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-400" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
