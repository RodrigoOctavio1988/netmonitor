/**
 * NetworkTopology.jsx — Fase 4.3: Topologia Interativa SVG com Zoom, Pan e Drag-and-Drop
 *
 * Funcionalidades:
 * - Conexões SVG interativas (Pai → Filhos) com curva Bezier suave
 * - Animação de "pulso" de dados em movimento ao longo das linhas para nós online
 * - Drag-and-drop para mover nós livremente com persistência em localStorage
 * - Zoom (0.4x a 2.5x via scroll ou botões) e Pan (arrastar tela)
 * - Botão de auto-organização hierárquica por árvore/subrede
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Server, Router, Network, Camera, Printer, Building2, Laptop,
  ShieldAlert, Activity, CheckCircle2, XCircle, Pencil, Trash2,
  MapPin, GitBranch, Layers, ZoomIn, ZoomOut, RotateCcw,
  Move, Zap, Lock, Unlock, Sparkles, RefreshCw, Link2, Unlink, Info
} from 'lucide-react';

const CATEGORY_ICONS = {
  'Servidores':       Server,
  'Roteadores':       Router,
  'Switches':         Network,
  'Câmeras IP':       Camera,
  'Impressoras':      Printer,
  'Setor Financeiro': Building2,
  'Outros':           Laptop
};

const NODE_WIDTH  = 200;
const NODE_HEIGHT = 90;
const STORAGE_KEY = 'netmonitor-topology-positions';

export default function NetworkTopology({ devices = [], onEditDevice, onDeleteDevice, onUpdateDevice }) {
  const containerRef = useRef(null);

  // Estado de transformação do canvas (Pan & Zoom)
  const [transform, setTransform] = useState({ x: 40, y: 40, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart,  setPanStart]  = useState({ x: 0, y: 0 });

  // Posições customizadas dos nós { [deviceId]: { x, y } }
  const [positions, setPositions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  // Nó sendo arrastado atualmente
  const [draggingNodeId,     setDraggingNodeId]     = useState(null);
  const [dragOffset,         setDragOffset]         = useState({ x: 0, y: 0 });
  const [selectedNodeId,     setSelectedNodeId]     = useState(null);
  const [animatePulse,       setAnimatePulse]       = useState(true);
  const [connectingSourceId, setConnectingSourceId] = useState(null);
  const [mousePos,           setMousePos]           = useState({ x: 0, y: 0 });

  // Grava posições no localStorage quando mudarem
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch (_) {}
  }, [positions]);

  // Algoritmo de auto-organização de layout (Hierárquico por Categoria/Pai)
  const autoOrganizeLayout = useCallback(() => {
    if (!devices || devices.length === 0) return;

    const newPositions = {};
    const categories = Array.from(new Set(devices.map(d => d.category || 'Outros')));
    const deviceMap  = new Map(devices.map(d => [d.id, d]));

    // Identifica nós raiz (sem parentId ou cujo pai não existe)
    const roots = devices.filter(d => !d.parentId || !deviceMap.has(d.parentId));

    // Se tiver roteador/gateway, posiciona no centro do topo
    const rowGap  = 160;
    const colGap  = 240;
    const startX  = 100;
    const startY  = 60;

    categories.forEach((cat, catIdx) => {
      const catDevices = devices.filter(d => (d.category || 'Outros') === cat);
      catDevices.forEach((dev, devIdx) => {
        // Posição em grade por categoria
        const x = startX + devIdx * colGap;
        const y = startY + catIdx * rowGap;
        newPositions[dev.id] = { x, y };
      });
    });

    setPositions(newPositions);
    setTransform({ x: 60, y: 40, scale: 1 });
  }, [devices]);

  // Inicializa posições padrão se algum dispositivo novo surgir
  useEffect(() => {
    if (!devices || devices.length === 0) return;
    let needsUpdate = false;
    const updated = { ...positions };

    devices.forEach((d, idx) => {
      if (!updated[d.id]) {
        needsUpdate = true;
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        updated[d.id] = { x: 80 + col * 250, y: 60 + row * 160 };
      }
    });

    if (needsUpdate) {
      setPositions(updated);
    }
  }, [devices]);

  // ── Controles de Pan & Zoom ────────────────────────────────────────────────
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform(prev => {
      const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.4), 2.5);
      return { ...prev, scale: newScale };
    });
  };

  const handleZoomIn  = () => setTransform(t => ({ ...t, scale: Math.min(t.scale * 1.2, 2.5) }));
  const handleZoomOut = () => setTransform(t => ({ ...t, scale: Math.max(t.scale / 1.2, 0.4) }));
  const handleReset   = () => setTransform({ x: 40, y: 40, scale: 1 });

  // Cancela o modo de conexão com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setConnectingSourceId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Handlers de Arrasto (Pan do Canvas vs Drag do Nó vs Ligar Nós) ─────────
  const handleMouseDownCanvas = (e) => {
    if (connectingSourceId) {
      setConnectingSourceId(null);
      return;
    }
    if (e.target.closest('.topology-node')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseDownNode = (e, deviceId) => {
    e.stopPropagation();

    // Se estiver em modo de conexão, o clique no nó define a relação pai-filho
    if (connectingSourceId) {
      if (connectingSourceId === deviceId) {
        setConnectingSourceId(null);
      } else {
        if (onUpdateDevice) {
          onUpdateDevice(connectingSourceId, { parentId: deviceId });
        }
        setConnectingSourceId(null);
      }
      return;
    }

    setSelectedNodeId(deviceId);
    setDraggingNodeId(deviceId);

    const pos = positions[deviceId] || { x: 0, y: 0 };
    setDragOffset({
      x: (e.clientX / transform.scale) - pos.x,
      y: (e.clientY / transform.scale) - pos.y
    });
  };

  const handleMouseMove = (e) => {
    if (connectingSourceId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
      const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;
      setMousePos({ x: canvasX, y: canvasY });
    }

    if (draggingNodeId) {
      const newX = Math.round((e.clientX / transform.scale) - dragOffset.x);
      const newY = Math.round((e.clientY / transform.scale) - dragOffset.y);
      setPositions(prev => ({
        ...prev,
        [draggingNodeId]: { x: Math.max(10, newX), y: Math.max(10, newY) }
      }));
    } else if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }));
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
  };

  const handleStartConnect = (e, deviceId) => {
    e.stopPropagation();
    if (connectingSourceId === deviceId) {
      setConnectingSourceId(null);
    } else {
      setConnectingSourceId(deviceId);
      const pos = positions[deviceId] || { x: 100, y: 100 };
      setMousePos({ x: pos.x + NODE_WIDTH / 2, y: pos.y + NODE_HEIGHT / 2 });
    }
  };

  const handleDisconnectParent = (e, deviceId) => {
    e.stopPropagation();
    if (onUpdateDevice) {
      onUpdateDevice(deviceId, { parentId: null });
    }
  };

  if (!devices || devices.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center border border-slate-800 my-4">
        <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3 animate-pulse" />
        <h3 className="text-lg font-bold text-white mb-1">Nenhum dispositivo na topologia</h3>
        <p className="text-sm text-slate-400">Adicione dispositivos para visualizar o mapa interativo da sua rede.</p>
      </div>
    );
  }

  // Mapeamento rápido de dispositivos
  const deviceMap = new Map(devices.map(d => [d.id, d]));

  // Conexões SVG (Pai → Filho ou por Subrede caso não tenha pai explícito)
  const connections = [];
  devices.forEach(device => {
    const pos = positions[device.id] || { x: 100, y: 100 };

    // Se possui dispositivo pai explícito
    if (device.parentId && deviceMap.has(device.parentId)) {
      const parentPos = positions[device.parentId] || { x: 100, y: 100 };
      const parentDevice = deviceMap.get(device.parentId);
      connections.push({
        id: `${device.parentId}->${device.id}`,
        from: { x: parentPos.x + NODE_WIDTH / 2, y: parentPos.y + NODE_HEIGHT / 2 },
        to:   { x: pos.x + NODE_WIDTH / 2,       y: pos.y + NODE_HEIGHT / 2 },
        isOnline: device.alive && parentDevice.alive,
        fromName: parentDevice.name,
        toName: device.name
      });
    } else if (!device.parentId) {
      // Se for dispositivo raiz (ex: Roteador/Switch) conecta a outros nós da mesma subrede
      const parts = (device.ip || '').split('.');
      if (parts.length === 4) {
        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const mainRouter = devices.find(d => d.id !== device.id && (d.category === 'Roteadores' || d.category === 'Switches') && d.ip.startsWith(subnet));
        if (mainRouter && !positions[device.id]) {
          const parentPos = positions[mainRouter.id] || { x: 100, y: 100 };
          connections.push({
            id: `subnet-${mainRouter.id}->${device.id}`,
            from: { x: parentPos.x + NODE_WIDTH / 2, y: parentPos.y + NODE_HEIGHT / 2 },
            to:   { x: pos.x + NODE_WIDTH / 2,       y: pos.y + NODE_HEIGHT / 2 },
            isOnline: device.alive && mainRouter.alive,
            fromName: mainRouter.name,
            toName: device.name
          });
        }
      }
    }
  });

  const onlineCount  = devices.filter(d => d.alive).length;
  const offlineCount = devices.length - onlineCount;

  return (
    <div className="space-y-4 animate-fade-in select-none">
      {/* Barra de Ferramentas Superior */}
      <div className="glass-card rounded-2xl p-4 border border-adaptive-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-600/20 rounded-xl border border-purple-500/30">
            <GitBranch className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-adaptive-primary flex items-center gap-2">
              Mapa de Topologia Interativo
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Drag & Zoom Real
              </span>
            </h3>
            <p className="text-xs text-adaptive-secondary">Arraste os nós para organizar ou use o scroll para aplicar zoom</p>
          </div>
        </div>

        {/* Estatísticas e Botões de Controle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-500/5 border border-adaptive-border text-adaptive-primary">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
            <span>{onlineCount} Online</span>
            <span className="text-adaptive-secondary">|</span>
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            <span>{offlineCount} Offline</span>
          </div>

          {/* Toggle de Pulso de Dados */}
          <button
            onClick={() => setAnimatePulse(p => !p)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              animatePulse
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-500/5 text-adaptive-secondary border-adaptive-border'
            }`}
            title="Ativar/Desativar efeito de pulso de fluxo de dados nas conexões"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Pulso {animatePulse ? 'Ativo' : 'Off'}</span>
          </button>

          {/* Botão de Modo Conexão Interativa */}
          <button
            onClick={() => setConnectingSourceId(prev => prev ? null : (selectedNodeId || devices[0]?.id))}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              connectingSourceId
                ? 'bg-sky-500/20 text-sky-400 border-sky-400/50 shadow-lg shadow-sky-500/20 animate-pulse'
                : 'bg-slate-500/5 hover:bg-slate-500/15 text-adaptive-primary border-adaptive-border'
            }`}
            title="Ligar nós diretamente no mapa (seleciona dispositivo filho e clica no pai)"
          >
            <Link2 className="h-3.5 w-3.5 text-sky-400" />
            <span>{connectingSourceId ? 'Conectando (Esc para sair)' : 'Ligar Nós'}</span>
          </button>

          {/* Botão de Auto-Organizar */}
          <button
            onClick={autoOrganizeLayout}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-500/5 hover:bg-slate-500/15 text-adaptive-primary border border-adaptive-border transition-all flex items-center gap-1.5"
            title="Redefinir posições para um layout automático em grade/categoria"
          >
            <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden sm:inline">Auto-Organizar</span>
          </button>

          {/* Controles Zoom */}
          <div className="flex items-center p-1 bg-slate-500/5 border border-adaptive-border rounded-xl">
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-adaptive-secondary hover:text-adaptive-primary rounded-lg hover:bg-slate-500/10"
              title="Aumentar Zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <span className="text-[10px] font-mono px-2 text-adaptive-secondary">
              {Math.round(transform.scale * 100)}%
            </span>
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-adaptive-secondary hover:text-adaptive-primary rounded-lg hover:bg-slate-500/10"
              title="Diminuir Zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 text-adaptive-secondary hover:text-adaptive-primary rounded-lg hover:bg-slate-500/10 ml-1 border-l border-adaptive-border"
              title="Redefinir Visualização"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Área Principal de Canvas da Topologia */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDownCanvas}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`glass-card rounded-2xl border border-adaptive-border relative overflow-hidden h-[600px] cursor-grab ${
          isPanning ? 'cursor-grabbing' : ''
        }`}
      >
        {/* Banner Flutuante de Instrução do Modo de Conexão */}
        {connectingSourceId && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/95 border border-sky-400/60 shadow-2xl backdrop-blur-md animate-tab-enter text-xs text-sky-200">
            <span className="flex h-2.5 w-2.5 rounded-full bg-sky-400 animate-ping" />
            <span>
              Conectando <strong>{deviceMap.get(connectingSourceId)?.name || 'Dispositivo'}</strong>: clique no <strong>dispositivo Pai</strong> (Gateway ou Switch)
            </span>
            <button
              onClick={() => setConnectingSourceId(null)}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700 font-semibold"
            >
              Cancelar (Esc)
            </button>
          </div>
        )}

        {/* Grid de fundo dinâmico */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#33415515_1px,transparent_1px),linear-gradient(to_bottom,#33415515_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"
          style={{
            backgroundPosition: `${transform.x}px ${transform.y}px`,
            backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`
          }}
        />

        {/* Instalação do Efeito de Animação de Pulso de Linha CSS embutido */}
        <style>{`
          @keyframes dashPulse {
            to {
              stroke-dashoffset: -32;
            }
          }
          .animated-connection-pulse {
            stroke-dasharray: 8, 8;
            animation: dashPulse 1.2s linear infinite;
          }
        `}</style>

        {/* Viewport transformado */}
        <div
          className="absolute origin-0 top-0 left-0 w-full h-full"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0'
          }}
        >
          {/* Camada SVG de Conexões e Linhas da Topologia */}
          <svg className="absolute inset-0 w-[4000px] h-[4000px] pointer-events-none overflow-visible z-0">
            <defs>
              {/* Gradiente para conexões ativas online */}
              <linearGradient id="lineGradOnline" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
              </linearGradient>
              {/* Gradiente para conexões offline */}
              <linearGradient id="lineGradOffline" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.5" />
              </linearGradient>

              {/* Filtro de Brilho Neon para linhas de conexão */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {connections.map(conn => {
              const { from, to, isOnline, id } = conn;
              // Curva suave Bezier estilo diagrama de rede
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const ctrlY1 = from.y + dy * 0.5;
              const ctrlY2 = to.y - dy * 0.5;
              const pathD = `M ${from.x} ${from.y} C ${from.x} ${ctrlY1}, ${to.x} ${ctrlY2}, ${to.x} ${to.y}`;

              return (
                <g key={id}>
                  {/* Sombra / Brilho de fundo da linha */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isOnline ? '#10b981' : '#ef4444'}
                    strokeWidth={isOnline ? 4 : 2}
                    strokeOpacity={isOnline ? 0.2 : 0.15}
                    filter={isOnline ? "url(#glow)" : undefined}
                  />

                  {/* Linha Principal da Conexão */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isOnline ? "url(#lineGradOnline)" : "#ef4444"}
                    strokeWidth={isOnline ? 2.5 : 1.5}
                    strokeDasharray={isOnline ? "none" : "6,6"}
                    strokeOpacity={isOnline ? 0.9 : 0.6}
                  />

                  {/* Efeito de Pulso Animado (Partículas de dados em movimento) */}
                  {isOnline && animatePulse && (
                    <>
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth={2.5}
                        className="animated-connection-pulse"
                        strokeOpacity={0.9}
                      />
                      {/* Ponto / Partícula de Luz pulsante navegando no caminho */}
                      <circle r="4" fill="#34d399">
                        <animateMotion path={pathD} dur="2.5s" repeatCount="indefinite" />
                      </circle>
                    </>
                  )}
                </g>
              );
            })}

            {/* Linha elástica temporária durante a conexão interativa */}
            {connectingSourceId && positions[connectingSourceId] && (
              <g>
                <line
                  x1={positions[connectingSourceId].x + NODE_WIDTH / 2}
                  y1={positions[connectingSourceId].y + NODE_HEIGHT / 2}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="#38bdf8"
                  strokeWidth={3}
                  strokeDasharray="6,6"
                  className="animated-connection-pulse"
                />
                <circle
                  cx={mousePos.x}
                  cy={mousePos.y}
                  r={5}
                  fill="#38bdf8"
                  className="animate-pulse"
                />
              </g>
            )}
          </svg>

          {/* Camada HTML de Cards de Nós da Rede */}
          <div className="relative z-10 w-[4000px] h-[4000px] pointer-events-none">
            {devices.map(device => {
              const pos = positions[device.id] || { x: 100, y: 100 };
              const Icon = CATEGORY_ICONS[device.category] || Laptop;
              const isSelected = selectedNodeId === device.id;
              const isDragging = draggingNodeId === device.id;
              const isConnectingSource = connectingSourceId === device.id;
              const isCandidateParent  = connectingSourceId && connectingSourceId !== device.id;
              const parentDevice = device.parentId ? deviceMap.get(device.parentId) : null;

              return (
                <div
                  key={device.id}
                  onMouseDown={e => handleMouseDownNode(e, device.id)}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`
                  }}
                  className={`topology-node absolute pointer-events-auto transition-all duration-150 select-none glass-card rounded-2xl p-3 border flex flex-col justify-between ${
                    isConnectingSource
                      ? 'ring-4 ring-sky-400 border-sky-400 bg-sky-950/40 shadow-2xl shadow-sky-500/40 scale-[1.03] z-40'
                      : isCandidateParent
                      ? 'border-emerald-400/80 bg-card-bg hover:ring-4 hover:ring-emerald-400 hover:border-emerald-400 cursor-pointer shadow-xl shadow-emerald-500/20 z-30'
                      : device.alive
                      ? 'border-emerald-500/30 hover:border-emerald-400 bg-card-bg shadow-lg shadow-emerald-950/10 cursor-move'
                      : 'border-rose-500/30 hover:border-rose-400 bg-rose-500/5 shadow-lg shadow-rose-950/10 cursor-move'
                  } ${
                    isSelected && !isConnectingSource ? 'ring-2 ring-blue-500 border-transparent scale-[1.02]' : ''
                  } ${
                    isDragging ? 'shadow-2xl shadow-blue-500/20 z-50 opacity-90' : ''
                  }`}
                  title={isCandidateParent ? `Clique para definir "${device.name}" como Nó Pai` : undefined}
                >
                  {/* Top Header: Ícone, Status e Nome */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <div className={`p-1.5 rounded-lg border flex-shrink-0 ${
                        device.alive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-xs text-adaptive-primary truncate font-display" title={device.name}>
                        {device.name}
                      </span>
                    </div>

                    {/* Status Dot */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {device.critical && (
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-400 fill-rose-400/10" title="Crítico" />
                      )}
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        device.alive
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                      }`} />
                    </div>
                  </div>

                  {/* Informações: IP, Porta e Latência */}
                  <div className="flex items-center justify-between text-[11px] font-mono mt-1">
                    <span className="text-adaptive-secondary">{device.ip}{device.port ? `:${device.port}` : ''}</span>
                    <span className={`font-semibold ${device.alive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {device.rtt}
                    </span>
                  </div>

                  {/* Rodapé do Card com Ações em Hover */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                    <div className="flex items-center gap-1 truncate max-w-[110px]">
                      {parentDevice ? (
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 truncate" title={`Conectado a: ${parentDevice.name}`}>
                          ↳ {parentDevice.name}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 truncate">
                          {device.category || 'Outros'}
                        </span>
                      )}
                    </div>

                    {/* Botões de Ação Interativos */}
                    <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
                      {/* Botão de Conectar / Definir Nó Pai */}
                      <button
                        onClick={e => handleStartConnect(e, device.id)}
                        className={`p-1 rounded transition-colors ${
                          isConnectingSource
                            ? 'text-sky-400 bg-sky-500/20'
                            : 'text-slate-400 hover:text-sky-400 hover:bg-sky-500/10'
                        }`}
                        title={isConnectingSource ? 'Cancelar conexão' : 'Ligar este nó a um Pai'}
                      >
                        <Link2 className="h-3 w-3" />
                      </button>

                      {/* Botão de Desvincular Nó Pai (se houver) */}
                      {device.parentId && (
                        <button
                          onClick={e => handleDisconnectParent(e, device.id)}
                          className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title="Desvincular do Nó Pai"
                        >
                          <Unlink className="h-3 w-3" />
                        </button>
                      )}

                      <button
                        onClick={e => { e.stopPropagation(); onEditDevice(device); }}
                        className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                        title="Editar"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteDevice(device.id); }}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                        title="Remover"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
