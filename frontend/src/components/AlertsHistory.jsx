/**
 * AlertsHistory.jsx — Fase 3.1: Sistema de Alertas Avançado
 * - Histórico completo com filtro por data, tipo e dispositivo
 * - Badge de não lidos
 * - Paginação
 * - Marcar como lido / marcar todos
 * - Limpar histórico de alertas com caixa de confirmação
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, AlertTriangle, AlertCircle, Info, CheckCircle2,
  Filter, Calendar, Search, RefreshCw, Inbox, ChevronLeft, ChevronRight,
  Trash2
} from 'lucide-react';

const PAGE_SIZE = 20;

export default function AlertsHistory({ apiUrl, onUnreadCountChange, authFetch, userRole = 'admin' }) {
  const [alerts,           setAlerts]           = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [filterType,       setFilterType]       = useState('all');
  const [searchQuery,      setSearchQuery]      = useState('');
  const [dateFrom,         setDateFrom]         = useState('');
  const [dateTo,           setDateTo]           = useState('');
  const [page,             setPage]             = useState(1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const myFetch = authFetch || fetch;

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await myFetch(`${apiUrl}/api/alerts?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
        const unread = data.filter(a => a.read === 0).length;
        if (onUnreadCountChange) onUnreadCountChange(unread);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [apiUrl, onUnreadCountChange, myFetch]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleMarkRead = async (id) => {
    try {
      await myFetch(`${apiUrl}/api/alerts/${id}/read`, { method: 'PUT' });
      setAlerts(prev => {
        const updated = prev.map(a => a.id === id ? { ...a, read: 1 } : a);
        const unread  = updated.filter(a => a.read === 0).length;
        if (onUnreadCountChange) onUnreadCountChange(unread);
        return updated;
      });
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await myFetch(`${apiUrl}/api/alerts/read-all`, { method: 'PUT' });
      setAlerts(prev => {
        const updated = prev.map(a => ({ ...a, read: 1 }));
        if (onUnreadCountChange) onUnreadCountChange(0);
        return updated;
      });
    } catch (_) {}
  };

  const handleClearAll = async () => {
    if (userRole !== 'admin') return;
    try {
      const res = await myFetch(`${apiUrl}/api/alerts`, { method: 'DELETE' });
      if (res.ok) {
        setAlerts([]);
        if (onUnreadCountChange) onUnreadCountChange(0);
      }
    } catch (_) {}
    finally {
      setShowClearConfirm(false);
    }
  };

  // Filtragem
  const filteredAlerts = alerts.filter(a => {
    // Tipo / Leitura
    if (filterType === 'unread'   && a.read !== 0)           return false;
    if (filterType === 'critical' && a.type !== 'critical')  return false;
    if (filterType === 'warning'  && a.type !== 'warning')   return false;
    if (filterType === 'info'     && a.type !== 'info')      return false;

    // Busca textual
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        (a.name    || '').toLowerCase().includes(q) ||
        (a.ip      || '').includes(q) ||
        (a.message || '').toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Filtro de data
    if (dateFrom) {
      const ts = new Date(a.timestamp).getTime();
      if (ts < new Date(dateFrom).getTime()) return false;
    }
    if (dateTo) {
      const ts = new Date(a.timestamp).getTime();
      if (ts > new Date(dateTo + 'T23:59:59').getTime()) return false;
    }

    return true;
  });

  // Paginação
  const totalPages   = Math.max(1, Math.ceil(filteredAlerts.length / PAGE_SIZE));
  const currentPage  = Math.min(page, totalPages);
  const pagedAlerts  = filteredAlerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filters change
  const applyFilter = (fn) => { fn(); setPage(1); };

  const unreadCount = alerts.filter(a => a.read === 0).length;

  const getAlertIcon = (type) => {
    switch (type) {
      case 'critical': return <AlertCircle  className="h-5 w-5 text-rose-400  flex-shrink-0" />;
      case 'warning':  return <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />;
      default:         return <Info          className="h-5 w-5 text-blue-400  flex-shrink-0" />;
    }
  };

  const getAlertBadge = (type) => {
    switch (type) {
      case 'critical': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'warning':  return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:         return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const FILTER_TABS = [
    { id: 'all',      label: 'Todos',         count: alerts.length },
    { id: 'unread',   label: 'Não Lidos',     count: unreadCount },
    { id: 'critical', label: 'Críticos',      count: alerts.filter(a => a.type === 'critical').length },
    { id: 'warning',  label: 'Alertas',       count: alerts.filter(a => a.type === 'warning').length },
    { id: 'info',     label: 'Informativos',  count: alerts.filter(a => a.type === 'info').length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="relative p-3 bg-blue-600/20 rounded-xl border border-blue-500/30">
            <Bell className="h-6 w-6 text-blue-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-[10px] font-bold bg-rose-500 text-white rounded-full shadow-lg shadow-rose-500/30">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-adaptive-primary">Histórico de Alertas</h2>
            <p className="text-xs text-adaptive-secondary">
              {unreadCount > 0
                ? <span className="text-rose-400 font-medium">{unreadCount} alerta{unreadCount !== 1 ? 's' : ''} não lido{unreadCount !== 1 ? 's' : ''}</span>
                : 'Todos os alertas estão lidos'}
              {' '}· {alerts.length} total
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-700/60 transition-all"
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 border border-adaptive-border text-adaptive-primary rounded-xl text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">Marcar Todos como Lidos</span>
            <span className="sm:hidden">Lidos</span>
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={alerts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Limpar Todos os Alertas"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Limpar Alertas</span>
            <span className="sm:hidden">Limpar</span>
          </button>
        </div>
      </div>

      {/* Filtros de Tipo */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 text-adaptive-secondary mr-1 flex-shrink-0" />
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => applyFilter(() => setFilterType(tab.id))}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0 flex items-center gap-1.5 ${
              filterType === tab.id
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                : 'bg-slate-500/5 text-adaptive-secondary hover:text-adaptive-primary border border-adaptive-border'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
              filterType === tab.id ? 'bg-white/20' : 'bg-slate-500/15'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filtros de Busca e Data */}
      <div className="glass-card p-4 rounded-2xl border border-adaptive-border">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Busca textual */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-adaptive-secondary pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por dispositivo, IP ou mensagem..."
              value={searchQuery}
              onChange={e => applyFilter(() => setSearchQuery(e.target.value))}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl glass-input"
            />
          </div>

          {/* Intervalo de Datas */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Calendar className="h-3.5 w-3.5 text-adaptive-secondary flex-shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => applyFilter(() => setDateFrom(e.target.value))}
              className="text-xs glass-input rounded-xl px-2 py-2 focus:outline-none"
              title="Data inicial"
            />
            <span className="text-adaptive-secondary text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => applyFilter(() => setDateTo(e.target.value))}
              className="text-xs glass-input rounded-xl px-2 py-2 focus:outline-none"
              title="Data final"
            />
          </div>
        </div>
      </div>

      {/* Lista de Alertas */}
      <div className="glass-card rounded-2xl overflow-hidden border border-adaptive-border">
        {loading ? (
          <div className="p-12 text-center text-adaptive-secondary text-sm flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin opacity-40" />
            <span>Carregando histórico de alertas...</span>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center text-adaptive-secondary">
            <Inbox className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhum alerta encontrado.</p>
            <p className="text-xs mt-1 opacity-60">Tente ajustar os filtros acima.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-adaptive-border">
              {pagedAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 sm:p-5 flex items-start gap-4 transition-all duration-200 ${
                    alert.read ? 'opacity-55 bg-transparent hover:opacity-70' : 'bg-blue-500/[0.04] hover:bg-blue-500/[0.07]'
                  }`}
                >
                  {/* Indicador de não lido */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    {getAlertIcon(alert.type)}
                    {!alert.read && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-slate-950" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-adaptive-primary">{alert.name}</span>
                      <span className="text-xs font-mono text-adaptive-secondary">({alert.ip})</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getAlertBadge(alert.type)}`}>
                        {alert.type}
                      </span>
                      {!alert.read && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          NOVO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-adaptive-secondary mt-1 leading-relaxed">{alert.message}</p>
                    <span className="text-[10px] text-adaptive-secondary/60 font-mono mt-1 block">
                      {new Date(alert.timestamp).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </span>
                  </div>

                  {!alert.read && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      title="Marcar como lido"
                      className="p-1.5 rounded-lg text-adaptive-secondary hover:text-emerald-400 hover:bg-emerald-500/10 border border-adaptive-border text-xs transition-all flex-shrink-0"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-adaptive-border bg-slate-900/20">
                <span className="text-xs text-adaptive-secondary font-mono">
                  {filteredAlerts.length} resultado{filteredAlerts.length !== 1 ? 's' : ''} · Página {currentPage} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed border border-adaptive-border transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {/* Números de página */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pg = i + 1;
                    if (totalPages > 5 && currentPage > 3) pg = currentPage - 2 + i;
                    if (pg > totalPages) return null;
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-medium transition-all ${
                          pg === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-800/40 border border-adaptive-border'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-800/40 disabled:opacity-30 disabled:cursor-not-allowed border border-adaptive-border transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Confirmação de Limpeza de Alertas */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setShowClearConfirm(false)}
          />
          <div className="relative glass-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-rose-500/30">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-adaptive-primary">Limpar Histórico de Alertas</h3>
                <p className="text-xs text-adaptive-secondary">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-adaptive-secondary mb-6 leading-relaxed">
              Tem certeza de que deseja apagar <strong className="text-adaptive-primary font-semibold">todos os {alerts.length} alertas</strong> registrados? O histórico de eventos será permanentemente removido.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-adaptive-secondary hover:text-adaptive-primary border border-adaptive-border hover:bg-slate-800/50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
