import React, { useState, useEffect } from 'react';
import {
  X, Info, Heart, Copy, Check, Mail, User, QrCode, Award, ShieldCheck
} from 'lucide-react';
import pixQrCodeSvg from '../assets/pix-qrcode.svg';

export default function AboutModal({ isOpen, onClose }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const PIX_KEY = 'rodrigo.octavio88@gmail.com';
  const PIX_PAYLOAD = '00020126490014br.gov.bcb.pix0127rodrigo.octavio88@gmail.com5204000053039865802BR5926RODRIGO OCTAVIO E OLIVEIRA6008BRASILIA62070503***63049E6B';

  // Fecha com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(PIX_PAYLOAD);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
      {/* Backdrop com desfoque */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card Principal do Modal - Perfeitamente dimensionado */}
      <div className="relative glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-2xl shadow-2xl border border-adaptive-border z-10 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-adaptive-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner flex-shrink-0">
              <Info className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-bold text-lg sm:text-xl text-adaptive-primary truncate">
                  Sobre o NetMonitor
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex-shrink-0">
                  v3.0.0
                </span>
              </div>
              <p className="text-xs text-adaptive-secondary mt-0.5 truncate">
                Sistema Inteligente de Monitoramento e Topologia de Rede
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-500/10 transition-colors flex-shrink-0 ml-2"
            title="Fechar (Esc)"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo do Modal com espaçamento harmônico */}
        <div className="py-4 space-y-4">
          {/* Seção 1: Desenvolvedor & Criador (Painel horizontal limpo) */}
          <div className="glass-panel p-4 rounded-2xl border border-adaptive-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-adaptive-secondary">
                    <User className="h-3.5 w-3.5 text-blue-400" />
                    Desenvolvedor & Criador
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Award className="h-3 w-3" />
                    Autor Oficial
                  </span>
                </div>
                <p className="font-display font-bold text-sm sm:text-base text-adaptive-primary tracking-wide">
                  RODRIGO OCTÁVIO EUSTÁQUIO DE OLIVEIRA
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`mailto:${PIX_KEY}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/25 transition-colors"
                  title="Enviar e-mail"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>{PIX_KEY}</span>
                </a>
                <button
                  onClick={handleCopyEmail}
                  className="p-1.5 rounded-xl text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-500/10 transition-colors border border-adaptive-border"
                  title="Copiar e-mail"
                >
                  {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Seção 2: Apoie via PIX com grid perfeitamente dimensionado */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-adaptive-border space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-400 animate-pulse fill-rose-400/20 flex-shrink-0" />
                <span className="font-display font-bold text-sm text-adaptive-primary">
                  Apoie o Projeto via PIX
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                Doação Voluntária
              </span>
            </div>

            <p className="text-xs text-adaptive-secondary leading-relaxed">
              Gostou do sistema e quer incentivar as próximas atualizações? Você pode contribuir com qualquer valor escaneando o QR Code ou copiando os dados abaixo:
            </p>

            {/* Grid QR Code + Chaves com espaço garantido para cada elemento */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-5 items-center pt-1">
              {/* QR Code centralizado */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center">
                <div className="bg-white p-2.5 rounded-2xl shadow-lg border border-slate-200 flex flex-col items-center">
                  <img
                    src={pixQrCodeSvg}
                    alt="QR Code PIX para doação"
                    className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
                  />
                  <span className="text-[9px] font-mono font-bold text-slate-800 mt-1 flex items-center gap-1">
                    <QrCode className="h-3 w-3 text-emerald-600" />
                    PIX Banco Central
                  </span>
                </div>
              </div>

              {/* Chaves e Botões com largura total na coluna direita */}
              <div className="sm:col-span-7 space-y-3 w-full min-w-0">
                {/* Chave E-mail */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-adaptive-secondary uppercase tracking-wider">
                    Chave PIX (E-mail):
                  </label>
                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    <div className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono rounded-xl glass-input truncate select-all text-adaptive-primary">
                      {PIX_KEY}
                    </div>
                    <button
                      onClick={handleCopyKey}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all flex-shrink-0 shadow-sm ${
                        copiedKey
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                      title="Copiar chave PIX"
                    >
                      {copiedKey ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Copiada!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Código PIX Copia e Cola */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-adaptive-secondary uppercase tracking-wider">
                    Código Pix Copia e Cola:
                  </label>
                  <button
                    onClick={handleCopyCode}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all min-w-0 ${
                      copiedCode
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'glass-input hover:border-blue-400 text-adaptive-primary'
                    }`}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">Código Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                        <span className="truncate">Copiar Código Completo do QR Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-adaptive-secondary pt-0.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Transferência instantânea via app bancário</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="pt-3 border-t border-adaptive-border flex items-center justify-between text-xs text-adaptive-secondary font-mono">
          <span>NetMonitor © 2026</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md hover:shadow-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
