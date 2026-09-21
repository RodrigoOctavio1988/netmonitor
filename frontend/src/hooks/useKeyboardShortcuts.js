/**
 * useKeyboardShortcuts.js — Fase 4.4: Atalhos de Teclado
 *
 * Atalhos suportados:
 * - Ctrl+K / Cmd+K : Abrir Command Palette (Busca Rápida e Comandos)
 * - Ctrl+N / Cmd+N : Focar formulário / modal de novo dispositivo
 * - Ctrl+S / Cmd+S : Alternar para varredura de rede
 * - Teclas 1, 2, 3, 4 : Alternar rapidamente entre as abas (1: Dashboard, 2: Scanner, 3: Analytics, 4: Alertas)
 * - ? : Abrir modal de ajuda com lista de atalhos
 * - Esc : Fechar modais / Command Palette
 */
import { useEffect } from 'react';

export default function useKeyboardShortcuts({
  setActiveTab,
  onOpenCommandPalette,
  onOpenAddDevice,
  onOpenHelpModal,
  onCloseModals
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignora atalhos se o usuário estiver digitando em um input, textarea ou select
      const activeElem = document.activeElement;
      const isInput =
        activeElem &&
        (activeElem.tagName === 'INPUT' ||
         activeElem.tagName === 'TEXTAREA' ||
         activeElem.tagName === 'SELECT' ||
         activeElem.isContentEditable);

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // ── ESC: Fechar qualquer modal ativo ──────────────────────────────────
      if (e.key === 'Escape') {
        if (onCloseModals) onCloseModals();
        return;
      }

      // ── Ctrl+K / Cmd+K — Abrir Command Palette / Busca Rápida ─────────────
      if (modifier && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (onOpenCommandPalette) onOpenCommandPalette();
        return;
      }

      // ── Ctrl+N / Cmd+N — Adicionar Novo Dispositivo ────────────────────────
      if (modifier && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        if (setActiveTab) setActiveTab('dashboard');
        if (onOpenAddDevice) onOpenAddDevice();
        return;
      }

      // ── Ctrl+S / Cmd+S — Ir para Varredura de Rede ────────────────────────
      if (modifier && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (setActiveTab) setActiveTab('scanner');
        return;
      }

      // Se estiver digitando num input, ignora os atalhos de tecla única
      if (isInput) return;

      // ── Teclas 1, 2, 3, 4 — Alternar entre Abas ───────────────────────────
      if (e.key === '1') {
        e.preventDefault();
        if (setActiveTab) setActiveTab('dashboard');
      } else if (e.key === '2') {
        e.preventDefault();
        if (setActiveTab) setActiveTab('scanner');
      } else if (e.key === '3') {
        e.preventDefault();
        if (setActiveTab) setActiveTab('analytics');
      } else if (e.key === '4') {
        e.preventDefault();
        if (setActiveTab) setActiveTab('alerts');
      }

      // ── Tecla ? — Mostrar Ajuda de Atalhos ─────────────────────────────────
      else if (e.key === '?') {
        e.preventDefault();
        if (onOpenHelpModal) onOpenHelpModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    setActiveTab,
    onOpenCommandPalette,
    onOpenAddDevice,
    onOpenHelpModal,
    onCloseModals
  ]);
}
