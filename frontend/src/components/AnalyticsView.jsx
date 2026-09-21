/**
 * AnalyticsView.jsx — Fase 3.2: Analytics Avançados com Recharts
 * - Gráfico de tendência de latência (AreaChart)
 * - Top dispositivos com pior uptime (BarChart)
 * - Heatmap de status dos hosts
 * - Distribuição por categoria (barra de progresso)
 * - Seletor de período: 24h, 7d, 30d
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine
} from 'recharts';
import {
  BarChart3, TrendingUp, ShieldAlert, Cpu, Activity, Clock,
  RefreshCw, Calendar, Wifi, WifiOff, AlertTriangle, ArrowDown
} from 'lucide-react';

// ── Tooltip customizado para latência ────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="glass-card border border-adaptive-border rounded-xl p-3 shadow-xl text-xs">
      <p className="text-adaptive-secondary mb-1 font-mono">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value !== null ? `${p.value} ms` : 'Offline'}
        </p>
      ))}
    </div>
  );
};

const PERIOD_OPTIONS = [
  { key: '24h', label: 'Últimas 24h' },
  { key: '7d',  label: 'Últimos 7 dias' },
  { key: '30d', label: 'Últimos 30 dias' },
];

export default function AnalyticsView({ devices, apiUrl, authFetch }) {
  const [period,       setPeriod]       = useState('24h');
  const [summary,      setSummary]      = useState(null);
  const [trend,        setTrend]        = useState([]);
  const [topWorst,     setTopWorst]     = useState([]);
  const [uptimeData,   setUptimeData]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedDev,  setSelectedDev]  = useState(null); // IP do dispositivo para tendência individual
  const [devTrend,     setDevTrend]     = useState([]);

  const myFetch = authFetch || fetch;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, trendRes, worstRes, uptimeRes] = await Promise.all([
        myFetch(`${apiUrl}/api/analytics/summary?period=${period}`),
        myFetch(`${apiUrl}/api/analytics/latency-trend?period=${period}`),
        myFetch(`${apiUrl}/api/analytics/top-worst?period=${period}&limit=5`),
        myFetch(`${apiUrl}/api/analytics/uptime?period=${period}`),
      ]);

      if (sumRes.ok)     setSummary(await sumRes.json());
      if (trendRes.ok) { const d = await trendRes.json(); setTrend(d.trend || []); }
      if (worstRes.ok) { const d = await worstRes.json(); setTopWorst(d.data || []); }
      if (uptimeRes.ok){ const d = await uptimeRes.json(); setUptimeData(d.data || []); }
    } catch (_) {}
    setLoading(false);
  }, [apiUrl, period, myFetch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Busca tendência de dispositivo individual
  useEffect(() => {
    if (!selectedDev) { setDevTrend([]); return; }
    const device = devices.find(d => d.ip === selectedDev);
    if (!device) return;
    myFetch(`${apiUrl}/api/analytics/latency-trend?device=${device.id}&period=${period}`)
      .then(r => r.json())
      .then(d => setDevTrend(d.trend || []))
      .catch(() => {});
  }, [selectedDev, period, apiUrl, devices, myFetch]);

  // Agrupamento por categoria (a partir dos dispositivos ativos)
  const categoriesMap = {};
  devices.forEach(d => {
    const cat = d.category || 'Outros';
    if (!categoriesMap[cat]) categoriesMap[cat] = { total: 0, online: 0 };
    categoriesMap[cat].total += 1;
    if (d.alive) categoriesMap[cat].online += 1;
  });

  const online  = devices.filter(d => d.alive).length;
  const offline = devices.length - online;
  const overallUptime = devices.length > 0 ? ((online / devices.length) * 100).toFixed(1) : '100.0';

  // Cor de uptime
  const uptimeColor = (pct) => {
    const n = parseFloat(pct);
    if (n >= 95) return '#10b981';
    if (n >= 70) return '#f59e0b';
    return '#ef4444';
  };

  // Dados para BarChart de top piores dispositivos
  const barData = topWorst.map(d => ({
    name:    d.name.length > 14 ? d.name.slice(0, 12) + '…' : d.name,
    uptime:  d.uptimePercent,
    avgRtt:  d.avgRtt,
    ip:      d.ip,
    fullName: d.name
  }));

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/30">
            <BarChart3 className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-adaptive-primary">Analytics & Métricas</h2>
            <p className="text-xs text-adaptive-secondary">Tendências de latência, uptime e saúde da rede</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de Período */}
          <div className="flex items-center gap-1 p-1 bg-slate-500/5 border border-adaptive-border rounded-xl">
            <Calendar className="h-3.5 w-3.5 text-adaptive-secondary ml-1.5" />
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === opt.key
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-adaptive-secondary hover:text-adaptive-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-2 rounded-xl text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-500/10 border border-adaptive-border transition-all"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Uptime Geral"
            value={summary.overallUptime !== null ? `${summary.overallUptime}%` : 'N/A'}
            icon={<Wifi className="h-5 w-5 text-emerald-400" />}
            color="text-emerald-400"
            bg="bg-emerald-500/10 border-emerald-500/20"
          />
          <SummaryCard
            label="Latência Média"
            value={summary.avgRtt !== null ? `${summary.avgRtt} ms` : 'N/A'}
            icon={<Clock className="h-5 w-5 text-amber-400" />}
            color="text-amber-400"
            bg="bg-amber-500/10 border-amber-500/20"
          />
          <SummaryCard
            label="Total de Checks"
            value={summary.totalChecks ?? 0}
            icon={<Activity className="h-5 w-5 text-blue-400" />}
            color="text-blue-400"
            bg="bg-blue-500/10 border-blue-500/20"
          />
          <SummaryCard
            label="Alertas Não Lidos"
            value={summary.unreadAlerts ?? 0}
            icon={<AlertTriangle className={`h-5 w-5 ${summary.unreadAlerts > 0 ? 'text-rose-400' : 'text-slate-400'}`} />}
            color={summary.unreadAlerts > 0 ? 'text-rose-400' : 'text-slate-400'}
            bg={summary.unreadAlerts > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800/30 border-slate-700/40'}
          />
        </div>
      )}

      {/* Gráfico de Tendência de Latência */}
      <div className="glass-card p-6 rounded-2xl border border-adaptive-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-adaptive-primary flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            Tendência de Latência — {PERIOD_OPTIONS.find(o => o.key === period)?.label}
          </h3>
          {/* Seletor de dispositivo individual */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-adaptive-secondary">Dispositivo:</span>
            <select
              value={selectedDev || ''}
              onChange={e => setSelectedDev(e.target.value || null)}
              className="text-xs glass-input rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value="">Média Geral</option>
              {devices.map(d => (
                <option key={d.id} value={d.ip}>{d.name} ({d.ip})</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="h-52 flex items-center justify-center text-adaptive-secondary text-xs">Carregando dados...</div>
        ) : (selectedDev ? devTrend : trend).length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-adaptive-secondary text-xs gap-2">
            <BarChart3 className="h-10 w-10 opacity-20" />
            <p>Sem dados de latência para o período selecionado.</p>
          </div>
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={selectedDev ? devTrend : trend}
                margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradAnalytics" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} unit="ms" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
                <Area
                  type="monotone"
                  dataKey="rtt"
                  name="Latência"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradAnalytics)"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-slate-500 text-right mt-1 font-mono">— 100ms (referência)</p>
          </div>
        )}
      </div>

      {/* Grid: Top Piores + Categoria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Top Piores Uptime */}
        <div className="glass-card p-6 rounded-2xl border border-adaptive-border space-y-4">
          <h3 className="text-sm font-bold text-adaptive-primary flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-rose-400" />
            Top Dispositivos — Pior Uptime
          </h3>

          {loading ? (
            <div className="h-40 flex items-center justify-center text-adaptive-secondary text-xs">Carregando...</div>
          ) : barData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-adaptive-secondary text-xs">Sem dados.</div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
                          <p className="font-semibold text-white mb-1">{d.fullName}</p>
                          <p className="text-slate-400 font-mono">{d.ip}</p>
                          <p className="text-emerald-400 mt-1">Uptime: {d.uptime !== null ? `${d.uptime}%` : 'N/A'}</p>
                          {d.avgRtt !== null && <p className="text-amber-400">Latência Média: {d.avgRtt} ms</p>}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="uptime" name="Uptime %" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={index} fill={uptimeColor(entry.uptime)} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Distribuição por Categoria */}
        <div className="glass-card p-6 rounded-2xl border border-adaptive-border space-y-4">
          <h3 className="text-sm font-bold text-adaptive-primary flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-400" />
            Disponibilidade por Categoria
          </h3>

          {Object.keys(categoriesMap).length === 0 ? (
            <div className="flex items-center justify-center h-40 text-adaptive-secondary text-xs">
              Nenhum dispositivo cadastrado.
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-52 pr-1">
              {Object.entries(categoriesMap).map(([cat, item]) => {
                const pct = ((item.online / item.total) * 100).toFixed(0);
                const barColor = parseInt(pct) >= 95 ? '#10b981' : parseInt(pct) >= 70 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-adaptive-primary font-medium">{cat}</span>
                      <span className="text-adaptive-secondary font-mono">{item.online}/{item.total} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-adaptive-border">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Heatmap de Status dos Hosts */}
      <div className="glass-card p-6 rounded-2xl border border-adaptive-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-adaptive-primary flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            Heatmap de Status dos Hosts
          </h3>
          <span className="text-xs font-mono text-adaptive-secondary">
            <span className="text-emerald-400">{online} Online</span> / <span className="text-rose-400">{offline} Offline</span>
          </span>
        </div>

        {devices.length === 0 ? (
          <div className="h-16 flex items-center justify-center text-adaptive-secondary text-xs">
            Nenhum dispositivo monitorado.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
              {devices.map(d => {
                const uptime = uptimeData.find(u => u.ip === d.ip);
                const pct    = uptime?.uptimePercent;
                const color  = d.alive
                  ? pct ? (parseFloat(pct) >= 95 ? 'bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25'
                    : parseFloat(pct) >= 70 ? 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25'
                    : 'bg-rose-500/15 border-rose-500/40 hover:bg-rose-500/25')
                    : 'bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20';

                return (
                  <div
                    key={d.id}
                    title={`${d.name}\n${d.ip}\nStatus: ${d.alive ? 'Online (' + d.rtt + ')' : 'Offline'}${pct ? '\nUptime: ' + pct + '%' : ''}`}
                    className={`h-12 rounded-xl border flex flex-col items-center justify-center p-1 transition-all hover:scale-105 cursor-pointer ${color}`}
                  >
                    <span className="text-[8px] font-bold truncate max-w-full text-center px-0.5 leading-tight">
                      {d.name.length > 8 ? d.name.slice(0, 7) + '…' : d.name}
                    </span>
                    <span className={`text-[7px] font-mono mt-0.5 ${d.alive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {d.alive ? d.rtt : 'OFF'}
                    </span>
                    {pct && (
                      <span className="text-[6px] font-mono text-slate-400 leading-tight">{pct}%</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Legenda */}
            <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1 border-t border-adaptive-border">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/40 inline-block" /><span>Online (≥95%)</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/40 inline-block" /><span>Instável (70–94%)</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500/30 border border-rose-500/40 inline-block" /><span>Crítico / Offline</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, bg }) {
  return (
    <div className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${bg}`}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <span className={`font-display font-bold text-2xl ${color}`}>{value}</span>
    </div>
  );
}
