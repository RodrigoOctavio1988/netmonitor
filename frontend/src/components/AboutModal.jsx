import React, { useState, useEffect } from 'react';
import {
  X, Info, Heart, Copy, Check, Mail, User, Sparkles, QrCode, Shield, Award
} from 'lucide-react';
import pixQrCodeSvg from '../assets/pix-qrcode.svg';

export default function AboutModal({ isOpen, onClose }) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop com desfoque */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card do Modal */}
      <div className="relative glass-card rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl border border-adaptive-border z-10 max-h-[92vh] overflow-y-auto">
        {/* Header com Botão Fechar */}
        <div className="flex items-start justify-between pb-5 border-b border-adaptive-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner">
              <Info className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-xl text-adaptive-primary">Sobre o NetMonitor</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  v3.0.0
                </span>
              </div>
              <p className="text-xs text-adaptive-secondary mt-0.5">
                Sistema Inteligente de Monitoramento e Topologia de Rede
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-500/10 transition-colors"
            title="Fechar (Esc)"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informações do Criador */}
        <div className="py-5 space-y-4">
          <div className="glass-panel p-4 rounded-2xl border border-adaptive-border space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-adaptive-secondary">
              <User className="h-4 w-4 text-blue-400" />
              <span>Desenvolvedor & Criador</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <p className="font-display font-bold text-base text-adaptive-primary tracking-wide">
                  RODRIGO OCTÁVIO EUSTÁQUIO DE OLIVEIRA
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-3.5 w-3.5 text-adaptive-secondary" />
                  <a
                    href="mailto:rodrigo.octavio88@gmail.com"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-mono"
                  >
                    rodrigo.octavio88@gmail.com
                  </a>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 self-start sm:self-center">
                <Award className="h-3.5 w-3.5" />
                Autor Oficial
              </span>
            </div>
          </div>

          {/* Área de Doação e Apoio via PIX */}
          <div className="glass-panel p-5 rounded-2xl border border-adaptive-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-400 animate-pulse fill-rose-400/20" />
                <span className="font-display font-bold text-sm text-adaptive-primary">
                  Apoie o Projeto via PIX
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Doação Voluntária
              </span>
            </div>

            <p className="text-xs text-adaptive-secondary leading-relaxed">
              Gostou do sistema e quer incentivar as próximas atualizações e melhorias? Você pode fazer uma contribuição de qualquer valor escaneando o QR Code abaixo com o app do seu banco!
            </p>

            {/* Container do QR Code e Chaves */}
            <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
              {/* Moldura do QR Code */}
              <div className="bg-white p-3 rounded-2xl shadow-lg border border-slate-200 flex-shrink-0 flex flex-col items-center">
                <img
                  src={pixQrCodeSvg}
                  alt="QR Code PIX para doação"
                  className="w-44 h-44 object-contain rounded-lg"
                />
                <span className="text-[10px] font-mono font-bold text-slate-800 mt-1 flex items-center gap-1">
                  <QrCode className="h-3 w-3 text-emerald-600" />
                  PIX Banco Central
                </span>
              </div>

              {/* Ações de Cópia da Chave e Copia-e-Cola */}
              <div className="flex-1 w-full space-y-3">
                {/* Chave Direta (Email) */}
                <div>
                  <label className="block text-[11px] font-semibold text-adaptive-secondary uppercase mb-1">
                    Chave PIX (E-mail):
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 text-xs font-mono rounded-xl glass-input truncate select-all">
                      {PIX_KEY}
                    </div>
                    <button
                      onClick={handleCopyKey}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 shadow-sm ${
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
                <div>
                  <label className="block text-[11px] font-semibold text-adaptive-secondary uppercase mb-1">
                    Código Pix Copia e Cola:
                  </label>
                  <button
                    onClick={handleCopyCode}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                      copiedCode
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'glass-input hover:border-blue-400 text-adaptive-primary'
                    }`}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Código Copia e Cola Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-blue-400" />
                        <span>Copiar Código Completo do QR Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="pt-4 border-t border-adaptive-border flex items-center justify-between text-xs text-adaptive-secondary font-mono">
          <span>NetMonitor © 2026</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
