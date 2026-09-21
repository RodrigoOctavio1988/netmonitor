/**
 * CommandPaletteModal.jsx — Fase 4.4: Command Palette (Ctrl+K)
 * Permite busca rápida global de dispositivos, navegação entre abas e ações do sistema
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Activity, ScanLine, BarChart3, Bell, Plus,
  Sun, Moon, Download, Shield, X, ArrowRight, Command, HelpCircle, Info
} from 'lucide-react';

export default function CommandPaletteModal({
  isOpen,
  onClose,
  devices = [],
  setActiveTab,
  onToggleTheme,
  theme,
  onOpenHelpModal,
  onOpenAboutModal
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Lista de ações rápidas
  const SYSTEM_COMMANDS = [
    {
      id: 'nav-dashboard',
      type: 'command',
      category: 'Navegação',
      title: 'Ir para Painel de Monitoramento',
      subtitle: 'Visão geral dos dispositivos e métricas',
      icon: Activity,
      action: () => { setActiveTab('dashboard'); onClose(); }
    },
    {
      id: 'nav-scanner',
      type: 'command',
      category: 'Navegação',
      title: 'Ir para Varredura de Rede',
      subtitle: 'Escanear IPs e encontrar novos hosts na LAN',
      icon: ScanLine,
      action: () => { setActiveTab('scanner'); onClose(); }
    },
    {
      id: 'nav-analytics',
      type: 'command',
      category: 'Navegação',
      title: 'Ir para Analytics & Métricas',
      subtitle: 'Gráficos de tendência, latência e uptime',
      icon: BarChart3,
      action: () => { setActiveTab('analytics'); onClose(); }
    },
    {
      id: 'nav-alerts',
      type: 'command',
      category: 'Navegação',
      title: 'Ir para Histórico de Alertas',
      subtitle: 'Registro de quedas e avisos de latência',
      icon: Bell,
      action: () => { setActiveTab('alerts'); onClose(); }
    },
    {
      id: 'toggle-theme',
      type: 'command',
      category: 'Configurações',
      title: theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro',
      subtitle: 'Alterar a aparência da interface',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => { onToggleTheme(); onClose(); }
    },
    {
      id: 'help-shortcuts',
      type: 'command',
      category: 'Ajuda',
      title: 'Ver Atalhos de Teclado (?)',
      subtitle: 'Exibir todos os atalhos disponíveis',
      icon: HelpCircle,
      action: () => { onClose(); if (onOpenHelpModal) onOpenHelpModal(); }
    },
    {
      id: 'about-system',
      type: 'command',
      category: 'Informações',
      title: 'Sobre o NetMonitor',
      subtitle: 'Versão v3.0.0, Criador e Doação PIX (QR Code)',
      icon: Info,
      action: () => { onClose(); if (onOpenAboutModal) onOpenAboutModal(); }
    }
  ];

  // Dispositivos filtrados pela busca
  const deviceResults = devices
    .filter(d => {
      if (!query.trim()) return false;
      const q = query.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.ip.includes(q) ||
        (d.category || '').toLowerCase().includes(q) ||
        (d.location || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 5)
    .map(d => ({
      id: `dev-${d.id}`,
      type: 'device',
      category: 'Dispositivo',
      title: d.name,
      subtitle: `${d.ip} — ${d.alive ? 'Online (' + d.rtt + ')' : 'Offline'}`,
      icon: d.critical ? Shield : Activity,
      action: () => { setActiveTab('dashboard'); onClose(); }
    }));

  const filteredCommands = SYSTEM_COMMANDS.filter(cmd => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return cmd.title.toLowerCase().includes(q) || cmd.subtitle.toLowerCase().includes(q);
  });

  const combinedResults = [...deviceResults, ...filteredCommands];

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(idx => (idx + 1) % Math.max(1, combinedResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(idx => (idx - 1 + combinedResults.length) % Math.max(1, combinedResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = combinedResults[selectedIndex];
      if (item && item.action) item.action();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass-card rounded-2xl w-full max-w-xl shadow-2xl border border-adaptive-border overflow-hidden z-10">
        {/* Campo de Busca */}
        <div className="p-4 border-b border-adaptive-border flex items-center gap-3 bg-slate-900/60">
          <Search className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite um comando ou busque por dispositivo..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-none text-sm text-adaptive-primary placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Lista de Resultados */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {combinedResults.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhum comando ou dispositivo encontrado para "{query}".
            </div>
          ) : (
            combinedResults.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all text-xs ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-adaptive-primary hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-slate-800 text-slate-300'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className={`text-[11px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className={`h-4 w-4 opacity-0 ${isSelected ? 'opacity-100' : ''}`} />
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com Dicas de Navegação */}
        <div className="p-3 border-t border-adaptive-border bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">↑↓</kbd> Navegar</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">↵</kbd> Selecionar</span>
          </div>
          <span>NetMonitor v3.0.0</span>
        </div>
      </div>
    </div>
  );
}
