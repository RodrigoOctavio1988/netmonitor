/**
 * Dashboard.jsx — NetMonitor v2.0.0
 *
 * Melhorias implementadas:
 * #6  Filtros e busca ativados (searchQuery + statusFilter aplicados à lista)
 * #7  Botão de edição em cada card → EditDeviceModal
 * #8  Rodapé com intervalo dinâmico
 * #9  Botões de exportação CSV, JSON e PDF
 * #16 Badge de Uptime % em cada card de dispositivo
 */
import React, { useState, useCallback } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import {
  Plus, Trash2, Shield, Activity, ShieldAlert,
  CheckCircle, Clock, Server, Sliders, Pencil,
  Search, Filter, FileJson, FileText, Download,
  Tag, MapPin, GitBranch, LayoutGrid, Layers, Zap, Database,
  List, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight
} from 'lucide-react';
import EditDeviceModal from './EditDeviceModal';
import NetworkTopology from './NetworkTopology';

export default function Dashboard({
  devices = [],
  onAddDevice,
  onDeleteDevice,
  onUpdateDevice,
  pingInterval,
  onUpdateInterval,
  serverLimits = { maxDevices: 50 },
  apiUrl = 'http://localhost:3001',
  userRole = 'admin'
}) {
  const [newIp,               setNewIp]               = useState('');
  const [newName,             setNewName]             = useState('');
  const [newPort,             setNewPort]             = useState('');
  const [newCategory,         setNewCategory]         = useState('Outros');
  const [newLocation,         setNewLocation]         = useState('');
  const [newLatencyThreshold, setNewLatencyThreshold] = useState('');
  const [isCritical,          setIsCritical]          = useState(false);
  const [selectedIp,          setSelectedIp]          = useState(null);
  const [errorMsg,            setErrorMsg]            = useState('');
  const [searchQuery,         setSearchQuery]         = useState('');            // #6
  const [statusFilter,        setStatusFilter]        = useState('all');         // #6
  const [categoryFilter,      setCategoryFilter]      = useState('all');
  const [subnetFilter,        setSubnetFilter]        = useState('all');
  const [viewMode,            setViewMode]            = useState('grid');        // 'grid' | 'list' | 'topology'
  const [sortBy,              setSortBy]              = useState('name');         // Fase 3.3
  const [sortDir,             setSortDir]             = useState('asc');          // Fase 3.3
  const [groupByCategory,     setGroupByCategory]     = useState(false);          // Fase 3.3
  const [editDevice,          setEditDevice]          = useState(null);          // #7
  const [deviceToDelete,      setDeviceToDelete]      = useState(null);          // #1.3 - Confirmação de exclusão
  const [exportLoading,       setExportLoading]       = useState('');          // #9
  const [pingingId,           setPingingId]           = useState(null);          // Fase 3 — Ping Manual
  const [isDbModalOpen,       setIsDbModalOpen]       = useState(false);
  const [dbStats,             setDbStats]             = useState(null);
  const [dbLoading,           setDbLoading]           = useState(false);
  const [dbFeedback,          setDbFeedback]          = useState('');

  // Extrai lista de categorias únicas existentes
  const availableCategories = Array.from(
    new Set(['Servidores', 'Roteadores', 'Switches', 'Câmeras IP', 'Setor Financeiro', 'Impressoras', 'Outros', ...devices.map(d => d.category).filter(Boolean)])
  );

  // Extrai lista de subredes únicas (ex: 192.168.1.x)
  const availableSubnets = Array.from(
    new Set(devices.map(d => {
      const parts = (d.ip || '').split('.');
      return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.x` : null;
    }).filter(Boolean))
  );

  // #6 — Lógica de filtro aplicada (Search, Status, Categoria e Subrede)
  const filteredDevices = devices.filter(d => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.ip.includes(q) ||
      (d.hostname || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q) ||
      (d.location || '').toLowerCase().includes(q);

    const matchStatus =
      statusFilter === 'all'      ? true :
      statusFilter === 'online'   ? d.alive :
      statusFilter === 'offline'  ? !d.alive :
      statusFilter === 'critical' ? d.critical :
      true;

    const matchCategory =
      categoryFilter === 'all' ? true : (d.category || 'Outros') === categoryFilter;

    const matchSubnet = (() => {
      if (subnetFilter === 'all') return true;
      const parts = (d.ip || '').split('.');
      const sub = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.x` : '';
      return sub === subnetFilter;
    })();

    return matchSearch && matchStatus && matchCategory && matchSubnet;
  });

  // Fase 3.3 — Ordenação
  const sortedDevices = [...filteredDevices].sort((a, b) => {
    let va, vb;
    switch (sortBy) {
      case 'ip':     va = a.ip.split('.').map(Number); vb = b.ip.split('.').map(Number);
                     for (let i = 0; i < 4; i++) { if (va[i] !== vb[i]) return sortDir === 'asc' ? va[i] - vb[i] : vb[i] - va[i]; } return 0;
      case 'status': va = a.alive ? 1 : 0; vb = b.alive ? 1 : 0; break;
      case 'rtt':    va = a.rawRtt ?? 9999; vb = b.rawRtt ?? 9999; break;
      case 'uptime': va = parseFloat(a.uptimePercent ?? 0); vb = parseFloat(b.uptimePercent ?? 0); break;
      default:       va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase();
                     return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  // Fase 3.3 — Agrupamento por categoria
  const groupedDevices = (() => {
    if (!groupByCategory) return null;
    const groups = {};
    sortedDevices.forEach(d => {
      const cat = d.category || 'Outros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    });
    return groups;
  })();

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-blue-400" />
      : <ArrowDown className="h-3 w-3 text-blue-400" />;
  };

  const activeDevice = devices.find(d => d.ip === selectedIp) || devices[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newIp.trim() || !newName.trim()) {
      setErrorMsg('IP e Nome são obrigatórios.');
      return;
    }

    const ipPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipPattern.test(newIp) && newIp !== 'localhost') {
      setErrorMsg('Por favor, insira um endereço IPv4 válido.');
      return;
    }

    if (newPort.trim()) {
      const portVal = parseInt(newPort.trim(), 10);
      if (isNaN(portVal) || portVal < 1 || portVal > 65535) {
        setErrorMsg('Por favor, insira uma porta TCP válida (1–65535).');
        return;
      }
    }

    let parsedThreshold = undefined;
    if (newLatencyThreshold.trim()) {
      const t = parseInt(newLatencyThreshold.trim(), 10);
      if (isNaN(t) || t < 1 || t > 10000) {
        setErrorMsg('Por favor, insira um limite de latência válido (1–10000 ms).');
        return;
      }
      parsedThreshold = t;
    }

    const deviceData = {
      ip:               newIp.trim(),
      name:             newName.trim(),
      category:         newCategory || 'Outros',
      location:         newLocation.trim(),
      critical:         isCritical,
      ...(newPort.trim() && { port: parseInt(newPort.trim(), 10) }),
      ...(parsedThreshold !== undefined && { latencyThreshold: parsedThreshold })
    };

    const success = await onAddDevice(deviceData);
    if (success) {
      setNewIp('');
      setNewName('');
      setNewPort('');
      setNewCategory('Outros');
      setNewLocation('');
      setNewLatencyThreshold('');
      setIsCritical(false);
    } else {
      setErrorMsg('Falha ao adicionar. Talvez este serviço já esteja monitorado.');
    }
  };

  // Gerenciamento e Purge do Banco de Dados SQLite
  const handleOpenDbModal = async () => {
    setIsDbModalOpen(true);
    setDbFeedback('');
    try {
      const token = localStorage.getItem('netmonitor-token');
      const res = await fetch(`${apiUrl}/api/settings/db-stats`, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) }
      });
      if (res.ok) setDbStats(await res.json());
    } catch (_) {}
  };

  const handleRunPurge = async (days = 30) => {
    setDbLoading(true);
    setDbFeedback('');
    try {
      const token = localStorage.getItem('netmonitor-token');
      const res = await fetch(`${apiUrl}/api/settings/purge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ days })
      });
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
        setDbFeedback(`Limpeza concluída! ${data.deletedHistory || 0} registros de latência e ${data.deletedAlerts || 0} alertas removidos. Banco otimizado.`);
      } else {
        setDbFeedback('Não foi possível executar a limpeza no servidor.');
      }
    } catch (_) {
      setDbFeedback('Falha ao conectar com o servidor.');
    }
    setDbLoading(false);
  };

  // #9 — Exportação
  const handleExport = (format) => {
    setExportLoading(format);
    window.open(`${apiUrl}/api/export?format=${format}`, '_blank');
    setTimeout(() => setExportLoading(''), 2000);
  };

  // Fase 3 — Ping Manual: dispara teste instantâneo no backend
  const handleManualPing = useCallback(async (e, device) => {
    e.stopPropagation();
    if (pingingId === device.id) return;
    setPingingId(device.id);
    try {
      await fetch(`${apiUrl}/api/devices/${device.id}/ping`, { method: 'POST' });
    } catch (_) {}
    setTimeout(() => setPingingId(null), 2000);
  }, [apiUrl, pingingId]);

  // Métricas
  const totalCount          = devices.length;
  const onlineCount         = devices.filter(d => d.alive).length;
  const offlineCount        = totalCount - onlineCount;
  const criticalOfflineCount = devices.filter(d => d.critical && !d.alive).length;

  const avgLatency = (() => {
    const onlineDevices = devices.filter(d => d.alive && d.rawRtt !== null);
    if (onlineDevices.length === 0) return '0 ms';
    const sum = onlineDevices.reduce((acc, curr) => acc + curr.rawRtt, 0);
    return `${(sum / onlineDevices.length).toFixed(1)} ms`;
  })();

  const FILTER_BTNS = [
    { key: 'all',      label: 'Todos',    count: totalCount },
    { key: 'online',   label: 'Online',   count: onlineCount },
    { key: 'offline',  label: 'Offline',  count: offlineCount },
    { key: 'critical', label: 'Críticos', count: devices.filter(d => d.critical).length }
  ];

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-adaptive-primary">Painel de Monitoramento</h2>
          <p className="text-adaptive-secondary text-sm mt-1">Status em tempo real de seus dispositivos locais e servidores</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Alternador de Modo de Visualização */}
          <div className="flex items-center p-1 bg-slate-500/5 border border-adaptive-border rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'grid' ? 'bg-blue-600 text-white shadow' : 'text-adaptive-secondary hover:text-adaptive-primary'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grade
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list' ? 'bg-emerald-600 text-white shadow' : 'text-adaptive-secondary hover:text-adaptive-primary'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
            <button
              onClick={() => setViewMode('topology')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'topology' ? 'bg-purple-600 text-white shadow' : 'text-adaptive-secondary hover:text-adaptive-primary'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Topologia
            </button>
          </div>

          {/* #9 — Botões de exportação */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-adaptive-secondary font-medium mr-1 hidden sm:inline">Exportar:</span>
            {[
              { format: 'csv', icon: Download,  label: 'CSV'  },
              { format: 'json', icon: FileJson,  label: 'JSON' },
              { format: 'pdf', icon: FileText,   label: 'PDF'  }
            ].map(({ format, icon: Icon, label }) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                disabled={devices.length === 0}
                title={`Exportar ${label}`}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-adaptive-border text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Icon className="h-3 w-3" />
                {exportLoading === format ? '...' : label}
              </button>
            ))}
          </div>
          {/* Botão de Manutenção/Otimização do Banco SQLite */}
          <button
            onClick={handleOpenDbModal}
            title="Estatísticas e Otimização do Banco de Dados SQLite"
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-purple-500/30 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-all flex items-center gap-1.5"
          >
            <Database className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden sm:inline">Banco SQLite</span>
          </button>

          {/* Intervalo */}
          <div className="flex items-center gap-2 bg-card-bg border border-adaptive-border px-3 py-1.5 rounded-xl ml-auto lg:ml-0">
            <Sliders className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs text-adaptive-secondary font-medium">Intervalo:</span>
            <select
              value={pingInterval}
              onChange={e => onUpdateInterval(Number(e.target.value))}
              className="text-xs bg-transparent border-none text-adaptive-primary rounded px-1.5 py-0.5 focus:outline-none cursor-pointer font-semibold font-mono"
            >
              <option value={2}>2s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <MetricCard title="Total Monitorados"     value={totalCount}  icon={Server}      color="text-blue-400"    bgColor="bg-blue-500/10 border-blue-500/20" />
        <MetricCard title="Dispositivos Online"   value={onlineCount} icon={CheckCircle} color="text-emerald-400" bgColor="bg-emerald-500/10 border-emerald-500/20" suffix={`/ ${totalCount}`} />
        <MetricCard title="Dispositivos Offline"  value={offlineCount} icon={ShieldAlert} color={offlineCount > 0 ? "text-rose-400" : "text-slate-400"} bgColor={offlineCount > 0 ? "bg-rose-500/10 border-rose-500/20" : "bg-slate-800/30 border-slate-800/60"} alert={criticalOfflineCount > 0} />
        <MetricCard title="Latência Média"        value={avgLatency}  icon={Clock}       color="text-amber-400"   bgColor="bg-amber-500/10 border-amber-500/20" />
      </div>

      {/* Modo de Topologia vs Modo Grade/Lista de Cards */}
      {viewMode === 'topology' ? (
        <NetworkTopology
          devices={sortedDevices}
          onEditDevice={setEditDevice}
          onDeleteDevice={setDeviceToDelete}
          onUpdateDevice={onUpdateDevice}
        />
      ) : viewMode === 'list' ? (
        /* ── MODO LISTA ──────────────────────────────────── */
        <div className="glass-card rounded-2xl overflow-hidden border border-adaptive-border">
          {/* Controles da Lista */}
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-adaptive-border bg-slate-900/20">
            {/* Busca e filtros de status */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-adaptive-secondary pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl glass-input"
              />
            </div>
            {/* Toggle Agrupamento */}
            <button
              onClick={() => setGroupByCategory(g => !g)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                groupByCategory
                  ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                  : 'text-slate-400 border-slate-700/60 hover:text-white'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              Agrupar por Categoria
            </button>
            <span className="text-xs text-adaptive-secondary font-mono ml-auto">
              {sortedDevices.length} dispositivo{sortedDevices.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Cabeçalho da Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-adaptive-border bg-slate-900/30">
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold uppercase tracking-wider w-8"></th>
                  {[
                    { col: 'name',   label: 'Nome' },
                    { col: 'ip',     label: 'IP' },
                    { col: 'status', label: 'Status' },
                    { col: 'rtt',    label: 'Latência' },
                    { col: 'uptime', label: 'Uptime' },
                  ].map(({ col, label }) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="text-left px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider cursor-pointer hover:text-white select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        {label}
                        <SortIcon col={col} />
                      </div>
                    </th>
                  ))}
                  <th className="text-left px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider">Categoria</th>
                  <th className="text-left px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider">Hostname</th>
                  <th className="px-3 py-3 text-slate-400 font-semibold uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-adaptive-border">
                {sortedDevices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-adaptive-secondary">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Nenhum dispositivo encontrado.</p>
                    </td>
                  </tr>
                ) : groupedDevices ? (
                  // Modo agrupado por categoria
                  Object.entries(groupedDevices).map(([cat, catDevices]) => (
                    <React.Fragment key={cat}>
                      <tr className="bg-slate-800/30">
                        <td colSpan={9} className="px-4 py-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-adaptive-primary">
                            <Tag className="h-3.5 w-3.5 text-blue-400" />
                            <span>{cat}</span>
                            <span className="text-adaptive-secondary font-normal ml-1">
                              ({catDevices.filter(d => d.alive).length}/{catDevices.length} online)
                            </span>
                          </div>
                        </td>
                      </tr>
                      {catDevices.map(device => (
                        <ListRow
                          key={device.id}
                          device={device}
                          onSelect={() => setSelectedIp(device.ip)}
                          isSelected={activeDevice && activeDevice.ip === device.ip}
                          onEdit={() => setEditDevice(device)}
                          onDelete={() => setDeviceToDelete(device)}
                          onPing={e => handleManualPing(e, device)}
                          pingingId={pingingId}
                        />
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  // Modo lista plana
                  sortedDevices.map(device => (
                    <ListRow
                      key={device.id}
                      device={device}
                      onSelect={() => setSelectedIp(device.ip)}
                      isSelected={activeDevice && activeDevice.ip === device.ip}
                      onEdit={() => setEditDevice(device)}
                      onDelete={() => setDeviceToDelete(device)}
                      onPing={e => handleManualPing(e, device)}
                      pingingId={pingingId}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna esquerda */}
          <div className="lg:col-span-2 space-y-6">
            {/* Formulário de adição */}
            <div className="glass-card p-5 rounded-2xl">
              <h3 className="font-display font-semibold text-base text-adaptive-primary mb-4 flex items-center gap-2">
                <Plus className="h-4.5 w-4.5 text-blue-400" />
                Adicionar Dispositivo ao Monitoramento
                <span className="ml-auto text-[10px] font-normal text-adaptive-secondary font-mono">
                  {devices.length}/{serverLimits.maxDevices} dispositivos
                </span>
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-adaptive-secondary">Endereço IP</label>
                    <input type="text" placeholder="ex: 192.168.1.1" value={newIp} onChange={e => setNewIp(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl glass-input" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-adaptive-secondary">Nome / Identificador</label>
                    <input type="text" placeholder="ex: Servidor DB" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl glass-input" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-adaptive-secondary">Categoria</label>
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl glass-input bg-slate-900 text-slate-200">
                      {['Servidores', 'Roteadores', 'Switches', 'Câmeras IP', 'Setor Financeiro', 'Impressoras', 'Outros'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-adaptive-secondary">Localização / Porta</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="ex: Rack 01" value={newLocation} onChange={e => setNewLocation(e.target.value)} className="w-full px-2.5 py-2 text-xs rounded-xl glass-input" />
                      <input type="number" placeholder="Porta" value={newPort} onChange={e => setNewPort(e.target.value)} className="w-16 px-2 py-2 text-xs rounded-xl glass-input" min="1" max="65535" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium text-adaptive-secondary cursor-pointer select-none">
                      <input type="checkbox" checked={isCritical} onChange={e => setIsCritical(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-0 h-4 w-4 cursor-pointer" />
                      <span>Dispositivo Crítico</span>
                    </label>
                    <div className="flex items-center gap-1.5 text-xs text-adaptive-secondary">
                      <span className="text-[11px]">Latência Máx:</span>
                      <input
                        type="number"
                        placeholder="200 ms"
                        value={newLatencyThreshold}
                        onChange={e => setNewLatencyThreshold(e.target.value)}
                        className="w-20 px-2 py-1 text-xs rounded-lg glass-input font-mono"
                        min="1"
                        max="10000"
                        title="Limite de latência em milissegundos para disparar alerta de lentidão"
                      />
                    </div>
                  </div>
                  <button type="submit" className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md hover:shadow-lg shadow-blue-600/10 flex items-center gap-1.5">
                    <Plus className="h-4 w-4" /> Adicionar
                  </button>
                </div>
              </form>
              {errorMsg && <p className="text-rose-400 text-xs mt-3 font-medium">{errorMsg}</p>}
            </div>

            {/* Busca e Filtros Rápidos */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-adaptive-secondary pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, IP, categoria ou localização..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl glass-input"
                  />
                </div>

                <div className="flex items-center gap-1.5 p-1 glass-card rounded-xl overflow-x-auto">
                  <Filter className="h-3.5 w-3.5 text-adaptive-secondary ml-1.5 flex-shrink-0" />
                  {FILTER_BTNS.map(btn => (
                    <button
                      key={btn.key}
                      onClick={() => setStatusFilter(btn.key)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        statusFilter === btn.key
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-700/30'
                      }`}
                    >
                      {btn.label}
                      <span className="ml-1 opacity-60">{btn.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtros de Categoria e Subrede */}
              <div className="flex flex-wrap items-center gap-3 glass-card p-2.5 rounded-xl text-xs">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-adaptive-secondary font-medium">Categoria:</span>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="glass-input rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="all">Todas ({totalCount})</option>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {availableSubnets.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-adaptive-secondary font-medium">Subrede:</span>
                    <select
                      value={subnetFilter}
                      onChange={e => setSubnetFilter(e.target.value)}
                      className="glass-input rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="all">Todas subredes</option>
                      {availableSubnets.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

          {/* Grade de dispositivos */}
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-base text-adaptive-secondary">
              Grade de Dispositivos
              {searchQuery && (
                <span className="ml-2 text-xs font-normal text-adaptive-secondary">
                  — {sortedDevices.length} resultado{sortedDevices.length !== 1 ? 's' : ''}
                </span>
              )}
            </h3>

            {devices.length === 0 ? (
              <div className="glass-card p-10 rounded-2xl text-center text-adaptive-secondary">
                <p>Nenhum dispositivo cadastrado no momento.</p>
                <p className="text-xs mt-1">Preencha o formulário acima ou faça uma Varredura de Rede para começar.</p>
              </div>
            ) : sortedDevices.length === 0 ? (
              <div className="glass-card p-10 rounded-2xl text-center text-adaptive-secondary">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Nenhum dispositivo encontrado para "{searchQuery}".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedDevices.map(device => {
                  const isSelected = activeDevice && activeDevice.ip === device.ip;
                  return (
                    <div
                      key={device.id}
                      onClick={() => setSelectedIp(device.ip)}
                      className={`glass-card p-4.5 rounded-2xl cursor-pointer relative overflow-hidden flex flex-col justify-between h-44 ${
                        isSelected ? 'ring-2 ring-blue-500/50 bg-slate-800/40' : ''
                      }`}
                    >
                      {/* Top Info */}
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2.5 items-center">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${device.alive ? 'bg-emerald-500 status-dot-green' : 'bg-rose-500 status-dot-red'}`} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-display font-bold text-sm text-adaptive-primary truncate max-w-[130px]" title={device.name}>
                                {device.name}
                              </h4>
                              {device.critical && <Shield className="h-3.5 w-3.5 text-rose-400 fill-rose-400/10" title="Crítico" />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-adaptive-secondary font-mono">{device.ip}</p>
                              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {device.category || 'Outros'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {device.alive && device.rawRtt && device.rawRtt > (device.latencyThreshold || 200) && (
                            <span className="text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse" title={`Latência (${device.rtt}) acima do limite configurado (${device.latencyThreshold || 200} ms)`}>
                              ⚠️ Alta
                            </span>
                          )}
                          <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                            device.alive
                              ? (device.rawRtt && device.rawRtt > (device.latencyThreshold || 200))
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {device.rtt}
                          </span>
                          {/* Ping Manual */}
                          <button
                            onClick={e => handleManualPing(e, device)}
                            className={`p-1 rounded-lg transition-colors ${
                              pingingId === device.id
                                ? 'text-amber-400 bg-amber-500/10 animate-pulse'
                                : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10'
                            }`}
                            title="Pingar Agora"
                            disabled={pingingId === device.id}
                          >
                            <Zap className="h-3.5 w-3.5" />
                          </button>
                          {/* #7 — Botão de edição */}
                          <button
                            onClick={e => { e.stopPropagation(); setEditDevice(device); }}
                            className="text-slate-500 hover:text-blue-400 p-1 rounded-lg hover:bg-slate-800/50 transition-colors"
                            title="Editar dispositivo"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeviceToDelete(device); }}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800/50 transition-colors"
                            title="Remover dispositivo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Host + Uptime (#16) */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-[10px] text-adaptive-secondary font-mono truncate">
                          Host: {device.hostname || 'Buscando...'}
                        </div>
                        {device.uptimePercent !== null && device.uptimePercent !== undefined && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${
                            parseFloat(device.uptimePercent) >= 95
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : parseFloat(device.uptimePercent) >= 70
                              ? 'text-amber-400 bg-amber-500/10'
                              : 'text-rose-400 bg-rose-500/10'
                          }`}>
                            ↑{device.uptimePercent}%
                          </span>
                        )}
                      </div>

                      {/* Mini Sparkline */}
                      <div className="h-12 w-full mt-2 overflow-hidden rounded-lg">
                        {device.history && device.history.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={device.history} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id={`grad-${device.ip.replace(/\./g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%"  stopColor={device.alive ? "#10b981" : "#ef4444"} stopOpacity={0.25} />
                                  <stop offset="95%" stopColor={device.alive ? "#10b981" : "#ef4444"} stopOpacity={0.0}  />
                                </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="rtt" stroke={device.alive ? "#10b981" : "#ef4444"} strokeWidth={1.5} fillOpacity={1} fill={`url(#grad-${device.ip.replace(/\./g, '-')})`} connectNulls={false} />
                              <XAxis dataKey="time" hide />
                              <YAxis hide domain={[0, 'auto']} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900/40 border border-dashed border-slate-800 rounded-lg">
                            <span className="text-[10px] text-adaptive-secondary">Aguardando dados...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita — Detalhes do host */}
        <div className="lg:col-span-1">
          <div className="glass-card p-5 rounded-2xl lg:sticky lg:top-8 lg:max-h-[calc(100vh-140px)] overflow-y-auto flex flex-col justify-between">
            {activeDevice ? (
              <>
                <div className="space-y-5">
                  <div className="flex justify-between items-start border-b border-adaptive-border pb-4">
                    <div>
                      <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">Detalhes do Host</span>
                      <h3 className="font-display font-bold text-lg text-adaptive-primary mt-1 truncate max-w-[200px]" title={activeDevice.name}>
                        {activeDevice.name}
                      </h3>
                      <p className="text-xs text-adaptive-secondary font-mono mt-0.5">{activeDevice.ip}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                        activeDevice.alive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {activeDevice.alive ? 'Online' : 'Offline'}
                      </span>
                      <span className="text-xs font-mono text-adaptive-secondary">{activeDevice.rtt}</span>
                    </div>
                  </div>

                  {/* Propriedades */}
                  <div className="grid grid-cols-2 gap-3.5 bg-slate-950/30 p-3.5 rounded-xl border border-adaptive-border text-xs">
                    <div>
                      <span className="text-adaptive-secondary block">Hostname</span>
                      <span className="text-adaptive-primary font-medium font-mono truncate block" title={activeDevice.hostname}>
                        {activeDevice.hostname || 'Desconhecido'}
                      </span>
                    </div>
                    <div>
                      <span className="text-adaptive-secondary block">Tipo</span>
                      <span className="text-adaptive-primary font-medium flex items-center gap-1">
                        {activeDevice.critical ? <><Shield className="h-3.5 w-3.5 text-rose-400" /><span>Crítico</span></> : <span>Padrão</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-adaptive-secondary block">Último RTT</span>
                      <span className="text-adaptive-primary font-mono font-medium">{activeDevice.rtt}</span>
                    </div>
                    <div>
                      <span className="text-adaptive-secondary block">Uptime</span>
                      <span className={`font-mono font-semibold ${
                        activeDevice.uptimePercent
                          ? parseFloat(activeDevice.uptimePercent) >= 95 ? 'text-emerald-400'
                          : parseFloat(activeDevice.uptimePercent) >= 70 ? 'text-amber-400'
                          : 'text-rose-400'
                          : 'text-adaptive-secondary'
                      }`}>
                        {activeDevice.uptimePercent ? `${activeDevice.uptimePercent}%` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-adaptive-secondary block">Medições</span>
                      <span className="text-adaptive-primary font-mono font-medium">
                        {activeDevice.history ? activeDevice.history.length : 0} pts
                      </span>
                    </div>
                    <div>
                      <span className="text-adaptive-secondary block">Protocolo</span>
                      <span className="text-adaptive-primary font-mono font-medium">
                        {activeDevice.port ? `TCP:${activeDevice.port}` : 'ICMP'}
                      </span>
                    </div>
                  </div>

                  {/* Gráfico de latência */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-adaptive-secondary uppercase tracking-widest flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Histórico de Latência
                    </h4>
                    <div className="h-56 w-full rounded-xl bg-slate-950/20 border border-adaptive-border p-2 overflow-hidden">
                      {activeDevice.history && activeDevice.history.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={activeDevice.history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRtt" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} unit="ms" />
                            <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#fff' }} labelStyle={{ fontWeight: 'bold' }} />
                            <Area type="monotone" dataKey="rtt" name="Latência (RTT)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRtt)" connectNulls={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-adaptive-secondary text-xs">
                          Sem dados no gráfico
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* #8 — Rodapé com intervalo dinâmico */}
                <div className="text-[10px] text-adaptive-secondary font-mono text-center border-t border-adaptive-border pt-4">
                  Atualização automática a cada {pingInterval}s
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-adaptive-secondary p-4 text-center">
                <Activity className="h-10 w-10 mb-3 animate-pulse opacity-40" />
                <p className="text-sm font-medium">Nenhum dispositivo selecionado</p>
                <p className="text-xs mt-1">Selecione um dispositivo da lista para ver os detalhes.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* #7 — Modal de edição */}
      {editDevice && (
        <EditDeviceModal
          device={editDevice}
          allDevices={devices}
          onSave={onUpdateDevice}
          onClose={() => setEditDevice(null)}
        />
      )}

      {/* #1.3 — Modal de confirmação de exclusão */}
      {deviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setDeviceToDelete(null)}
          />
          <div className="relative glass-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-rose-500/30 animate-modal-enter">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-adaptive-primary">Confirmar Exclusão</h3>
                <p className="text-xs text-adaptive-secondary">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-adaptive-secondary mb-6 leading-relaxed">
              Tem certeza que deseja remover o dispositivo{' '}
              <strong className="text-adaptive-primary font-semibold">{deviceToDelete.name}</strong> ({deviceToDelete.ip}) do monitoramento?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeviceToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-adaptive-secondary hover:text-adaptive-primary border border-adaptive-border hover:bg-slate-800/50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteDevice(deviceToDelete.id);
                  setDeviceToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Manutenção e Purge do Banco de Dados SQLite */}
      {isDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setIsDbModalOpen(false)}
          />
          <div className="relative glass-card rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-purple-500/30 animate-modal-enter max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-adaptive-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-adaptive-primary">Banco de Dados SQLite</h3>
                  <p className="text-xs text-adaptive-secondary">Gerenciamento de armazenamento e limpeza de histórico</p>
                </div>
              </div>
              <button
                onClick={() => setIsDbModalOpen(false)}
                className="p-1.5 rounded-lg text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Estatísticas de Disco e Registros */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-5">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Tamanho em Disco</span>
                <span className="text-lg font-bold font-mono text-purple-400 mt-0.5 block">{dbStats?.sizeMb || '...'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Total de Pings</span>
                <span className="text-lg font-bold font-mono text-blue-400 mt-0.5 block">{dbStats?.totalHistory ?? '...'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Alertas Salvos</span>
                <span className="text-lg font-bold font-mono text-amber-400 mt-0.5 block">{dbStats?.totalAlerts ?? '...'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-slate-300 space-y-1.5 mb-5">
              <p className="font-semibold text-purple-300 flex items-center gap-1.5">
                <span>⚡</span> Otimização e Limpeza Automática
              </p>
              <p className="text-slate-400 leading-relaxed">
                O NetMonitor executa um purge automático diário a cada 24 horas. Ao acionar a limpeza manual, registros antigos com mais de 30 dias e alertas lidos são removidos, e o comando <code className="text-purple-300 bg-purple-950/60 px-1 py-0.5 rounded font-mono">VACUUM</code> é executado para liberar fisicamente espaço no disco rígido do Windows.
              </p>
            </div>

            {dbFeedback && (
              <div className={`p-3 rounded-xl text-xs font-medium mb-4 ${
                dbFeedback.startsWith('Limpeza') || dbFeedback.startsWith('Sucesso')
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}>
                {dbFeedback}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 justify-end pt-2 border-t border-adaptive-border">
              <button
                onClick={() => setIsDbModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-adaptive-secondary hover:text-adaptive-primary border border-adaptive-border hover:bg-slate-800/50 transition-all"
              >
                Fechar
              </button>
              <button
                onClick={() => handleRunPurge(30)}
                disabled={dbLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Database className="h-3.5 w-3.5" />
                {dbLoading ? 'Otimizando...' : 'Executar Otimização (30 Dias)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, bgColor, suffix, alert = false }) {
  return (
    <div className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${bgColor} ${alert ? 'ring-1 ring-rose-500/30 shadow-lg shadow-rose-950/20' : ''}`}>
      <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 pointer-events-none">
        <Icon className="h-24 w-24" />
      </div>
      <div className="flex justify-between items-start">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        <Icon className={`h-5 w-5 ${color} ${alert ? 'animate-bounce' : ''}`} />
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display font-bold text-2xl text-white">{value}</span>
        {suffix && <span className="text-slate-400 text-xs font-mono">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Linha da tabela no modo lista (Fase 3.3) ─────────────────────────────────
function ListRow({ device, onSelect, isSelected, onEdit, onDelete, onPing, pingingId }) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer transition-colors text-xs ${
        isSelected
          ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
          : 'hover:bg-slate-800/30'
      }`}
    >
      {/* Indicador de status */}
      <td className="px-4 py-3">
        <div className={`w-2.5 h-2.5 rounded-full ${
          device.alive ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-rose-500 shadow-[0_0_6px_#ef4444]'
        }`} />
      </td>

      {/* Nome */}
      <td className="px-3 py-3 max-w-[140px]">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-adaptive-primary truncate">{device.name}</span>
          {device.critical && (
            <Shield className="h-3 w-3 text-rose-400 fill-rose-400/10 flex-shrink-0" title="Crítico" />
          )}
        </div>
      </td>

      {/* IP */}
      <td className="px-3 py-3">
        <span className="font-mono text-adaptive-secondary">{device.ip}</span>
        {device.port && (
          <span className="ml-1 text-[10px] text-blue-400 font-mono">:{device.port}</span>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-3">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          device.alive
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        }`}>
          {device.alive ? 'Online' : 'Offline'}
        </span>
      </td>

      {/* Latência */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-semibold ${
            device.alive
              ? (device.rawRtt && device.rawRtt > (device.latencyThreshold || 200)) ? 'text-amber-400 font-bold' : 'text-emerald-400'
              : 'text-rose-400'
          }`}>
            {device.rtt}
          </span>
          {device.alive && device.rawRtt && device.rawRtt > (device.latencyThreshold || 200) && (
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30" title={`Acima do limite configurado (${device.latencyThreshold || 200} ms)`}>
              ⚠️ Lento
            </span>
          )}
        </div>
      </td>

      {/* Uptime */}
      <td className="px-3 py-3">
        {device.uptimePercent !== null && device.uptimePercent !== undefined ? (
          <div className="flex items-center gap-2 min-w-[70px]">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-adaptive-border">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${device.uptimePercent}%`,
                  backgroundColor: parseFloat(device.uptimePercent) >= 95 ? '#10b981'
                    : parseFloat(device.uptimePercent) >= 70 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>
            <span className={`font-mono text-[10px] font-semibold ${
              parseFloat(device.uptimePercent) >= 95 ? 'text-emerald-400'
                : parseFloat(device.uptimePercent) >= 70 ? 'text-amber-400' : 'text-rose-400'
            }`}>{device.uptimePercent}%</span>
          </div>
        ) : (
          <span className="text-adaptive-secondary font-mono">N/A</span>
        )}
      </td>

      {/* Categoria */}
      <td className="px-3 py-3">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {device.category || 'Outros'}
        </span>
      </td>

      {/* Hostname */}
      <td className="px-3 py-3 max-w-[140px]">
        <span className="font-mono text-adaptive-secondary truncate block">{device.hostname || '—'}</span>
      </td>

      {/* Ações */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={e => { e.stopPropagation(); onPing(e); }}
            className={`p-1.5 rounded-lg transition-colors ${
              pingingId === device.id
                ? 'text-amber-400 bg-amber-500/10 animate-pulse'
                : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10'
            }`}
            title="Pingar Agora"
            disabled={pingingId === device.id}
          >
            <Zap className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800/50 transition-colors"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/50 transition-colors"
            title="Remover"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
