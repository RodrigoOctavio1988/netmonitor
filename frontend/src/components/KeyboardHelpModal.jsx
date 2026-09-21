/**
 * KeyboardHelpModal.jsx — Fase 4.4: Modal de Ajuda de Atalhos de Teclado (?)
 */
import React from 'react';
import { Keyboard, X, Command } from 'lucide-react';

export default function KeyboardHelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const SHORTCUTS = [
    { keys: ['Ctrl', 'K'], label: 'Abrir Busca Rápida (Command Palette)' },
    { keys: ['Ctrl', 'N'], label: 'Ir para Dashboard & Adicionar Dispositivo' },
    { keys: ['Ctrl', 'S'], label: 'Ir para Varredura de Rede' },
    { keys: ['1'],         label: 'Aba Painel de Monitoramento' },
    { keys: ['2'],         label: 'Aba Varredura de IP' },
    { keys: ['3'],         label: 'Aba Analytics & Métricas' },
    { keys: ['4'],         label: 'Aba Histórico de Alertas' },
    { keys: ['?'],         label: 'Abrir esta tela de ajuda de atalhos' },
    { keys: ['Esc'],       label: 'Fechar qualquer janela ou busca aberta' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass-card rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-adaptive-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-adaptive-border pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Keyboard className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-adaptive-primary">Atalhos de Teclado</h3>
              <p className="text-xs text-adaptive-secondary">Navegação rápida por comandos de teclado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabela de Atalhos */}
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {SHORTCUTS.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs"
            >
              <span className="text-adaptive-primary font-medium">{item.label}</span>
              <div className="flex items-center gap-1 font-mono">
                {item.keys.map((k, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div className="mt-5 pt-4 border-t border-adaptive-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
