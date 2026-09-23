import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Activity } from 'lucide-react';
import Sidebar             from './components/Sidebar';
import Dashboard           from './components/Dashboard';
import NetworkScanner      from './components/NetworkScanner';
import AlertsHistory       from './components/AlertsHistory';
import AnalyticsView       from './components/AnalyticsView';
import ToastContainer      from './components/ToastContainer';
import CommandPaletteModal from './components/CommandPaletteModal';
import KeyboardHelpModal   from './components/KeyboardHelpModal';
import AboutModal          from './components/AboutModal';
import LoginView           from './components/LoginView';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';

// #5 — URLs via variável de ambiente
const WS_URL  = import.meta.env.VITE_WS_URL  || 'ws://localhost:3001';
const API_URL = import.meta.env.VITE_API_URL  || 'http://localhost:3001';

// #2 — Emite um bipe de alerta via Web Audio API
function playAlertSound() {
  try {
    const ACtx = window.AudioContext || window.webkitAudioContext;
    if (!ACtx) return;
    const ctx  = new ACtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

// #2 — Envia notificação nativa do SO
function sendOsNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/favicon.ico', tag: 'netmonitor-alert' });
    } catch (_) {}
  }
}

export default function App() {
  // Autenticação JWT & RBAC
  const [token, setToken] = useState(() => localStorage.getItem('netmonitor-token') || '');
  const [user, setUser]   = useState(() => {
    try {
      const stored = localStorage.getItem('netmonitor-user');
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });

  const [activeTab,           setActiveTab]           = useState('dashboard');
  const [wsStatus,            setWsStatus]            = useState('disconnected');
  const [devices,             setDevices]             = useState([]);
  const [theme,               setTheme]               = useState(() => localStorage.getItem('netmonitor-theme') || 'dark');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [scanState, setScanState] = useState({
    status:       'idle',
    progress:     0,
    scanned:      0,
    total:        0,
    foundDevices: []
  });

  const [networkInfo,   setNetworkInfo]   = useState({ localIp: '', startIp: '192.168.1.1', endIp: '192.168.1.25' });
  const [pingInterval,         setPingInterval]         = useState(5);
  const [toasts,               setToasts]               = useState([]);
  const [serverLimits,         setServerLimits]         = useState({ maxDevices: 50 });
  const [unreadAlerts,         setUnreadAlerts]         = useState(0);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpModalOpen,       setIsHelpModalOpen]       = useState(false);
  const [isAboutModalOpen,      setIsAboutModalOpen]      = useState(false);

  // Abertura exclusiva de modais para prevenir sobreposição
  const handleOpenCommandPalette = () => {
    setIsHelpModalOpen(false);
    setIsAboutModalOpen(false);
    setIsMobileSidebarOpen(false);
    setIsCommandPaletteOpen(true);
  };

  const handleOpenHelpModal = () => {
    setIsCommandPaletteOpen(false);
    setIsAboutModalOpen(false);
    setIsMobileSidebarOpen(false);
    setIsHelpModalOpen(true);
  };

  const handleOpenAboutModal = () => {
    setIsCommandPaletteOpen(false);
    setIsHelpModalOpen(false);
    setIsMobileSidebarOpen(false);
    setIsAboutModalOpen(true);
  };

  const handleCloseAllModals = () => {
    setIsCommandPaletteOpen(false);
    setIsHelpModalOpen(false);
    setIsAboutModalOpen(false);
    setIsMobileSidebarOpen(false);
  };

  // Atalhos de Teclado
  useKeyboardShortcuts({
    setActiveTab,
    onOpenCommandPalette: handleOpenCommandPalette,
    onOpenAddDevice:      () => { setActiveTab('dashboard'); },
    onOpenHelpModal:      handleOpenHelpModal,
    onCloseModals:        handleCloseAllModals
  });

  const prevDevicesRef = useRef([]);
  const wsRef          = useRef(null);
  const retryDelayRef  = useRef(1000);

  // Aplica o tema ao <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
      root.classList.remove('dark');
    } else {
      root.classList.remove('light-theme');
      root.classList.add('dark');
    }
    localStorage.setItem('netmonitor-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Solicita permissão para notificações do SO
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const addToast = useCallback((type, message) => {
    setToasts(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
        type,
        message
      }
    ]);
  }, []);

  // Valida o Token JWT no carregamento inicial
  useEffect(() => {
    if (!token) return;
    async function validateSession() {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem('netmonitor-user', JSON.stringify(data.user));
        } else {
          // Token expirado ou inválido
          handleLogout();
        }
      } catch (_) {}
    }
    validateSession();
  }, [token]);

  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('netmonitor-token', newToken);
    localStorage.setItem('netmonitor-user', JSON.stringify(newUser));
    addToast('success', `Bem-vindo, ${newUser.name || newUser.username}! Perfil: ${newUser.role === 'admin' ? 'Administrador' : 'Operador'}`);
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('netmonitor-token');
    localStorage.removeItem('netmonitor-user');
    addToast('info', 'Sessão encerrada com sucesso.');
  };

  // Helper para requisições autenticadas
  const authFetch = useCallback(async (url, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
    } else if (res.status === 403) {
      addToast('warning', 'Acesso Negado: Ação restrita a Administradores.');
    }
    return res;
  }, [token, addToast]);

  // Detecção de quedas e reestabelecimento com o horário da falha
  const detectStatusChanges = useCallback((prevList, newList) => {
    if (!prevList || prevList.length === 0) return;

    newList.forEach((newDevice) => {
      const oldDevice = prevList.find(d => d.ip === newDevice.ip);
      if (!oldDevice || oldDevice.rtt === 'Carregando...') return;

      const timestamp = newDevice.lastCheckedAt || new Date().toLocaleTimeString('pt-BR');

      if (oldDevice.alive && !newDevice.alive) {
        if (newDevice.critical) {
          addToast('danger', `[${timestamp}] O dispositivo crítico "${newDevice.name}" (${newDevice.ip}) caiu e está offline.`);
          sendOsNotification('⚠️ Dispositivo Crítico Offline', `[${timestamp}] ${newDevice.name} (${newDevice.ip}) está offline!`);
          playAlertSound();
        } else {
          addToast('warning', `[${timestamp}] O dispositivo "${newDevice.name}" (${newDevice.ip}) está offline.`);
        }
      } else if (!oldDevice.alive && newDevice.alive) {
        addToast('success', `[${timestamp}] O dispositivo "${newDevice.name}" (${newDevice.ip}) voltou a ficar online.`);
        if (newDevice.critical) {
          sendOsNotification('✅ Dispositivo Recuperado', `[${timestamp}] ${newDevice.name} (${newDevice.ip}) está online novamente.`);
        }
      }
    });
  }, [addToast]);

  // WebSocket com token JWT
  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      const wsUrlWithToken = `${WS_URL}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrlWithToken);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsStatus('connected');
        retryDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'monitoring-update') {
            setDevices(currentDevices => {
              detectStatusChanges(currentDevices, data.devices);
              prevDevicesRef.current = data.devices;
              return data.devices;
            });
          } else if (data.type === 'scan-start') {
            setScanState({ status: 'scanning', progress: 0, scanned: 0, total: data.total, foundDevices: [] });
          } else if (data.type === 'scan-progress') {
            setScanState(prev => {
              const newFound = [...prev.foundDevices];
              data.foundDevices.forEach(device => {
                if (!newFound.some(d => d.ip === device.ip)) newFound.push(device);
              });
              return { ...prev, progress: data.progress, scanned: data.scanned, foundDevices: newFound };
            });
          } else if (data.type === 'scan-complete') {
            setScanState(prev => ({ ...prev, status: 'complete', progress: 100 }));
          } else if (data.type === 'scan-error') {
            setScanState(prev => ({ ...prev, status: 'error' }));
            addToast('warning', `Erro no escaneamento: ${data.message}`);
          } else if (data.type === 'settings-update') {
            setPingInterval(data.interval);
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsStatus('disconnected');

        const delay = retryDelayRef.current;
        const jitter = Math.random() * 500;
        retryDelayRef.current = Math.min(delay * 2, 30000);

        setTimeout(connect, delay + jitter);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, detectStatusChanges, addToast]);

  // Busca inicial de dados protegida por JWT
  useEffect(() => {
    if (!token) return;
    async function fetchInitialData() {
      try {
        const [devRes, netRes, healthRes] = await Promise.all([
          authFetch(`${API_URL}/api/devices`),
          authFetch(`${API_URL}/api/network-info`),
          authFetch(`${API_URL}/api/health`)
        ]);

        if (devRes.ok) {
          const data = await devRes.json();
          setDevices(data.map(d => ({ ...d, alive: false, rtt: 'Carregando...', history: [] })));
        }
        if (netRes.ok) {
          setNetworkInfo(await netRes.json());
        }
        if (healthRes.ok) {
          const health = await healthRes.json();
          setServerLimits({ maxDevices: health.maxDevices || 50 });
        }
      } catch (_) {}
    }
    fetchInitialData();
  }, [token, authFetch]);

  // ── CRUD de dispositivos (com RBAC) ───────────────────────────────────────

  const handleAddDevice = async (deviceData) => {
    if (user?.role !== 'admin') {
      addToast('warning', 'Acesso Negado: Apenas Administradores podem adicionar dispositivos.');
      return false;
    }
    try {
      const res = await authFetch(`${API_URL}/api/devices`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(deviceData)
      });
      if (res.ok) {
        const newDevice = await res.json();
        addToast('success', `Dispositivo "${newDevice.name}" adicionado com sucesso.`);
        const refreshed = await authFetch(`${API_URL}/api/devices`);
        if (refreshed.ok) setDevices(await refreshed.json());
        return true;
      }
      const err = await res.json();
      addToast('warning', err.error || 'Erro ao adicionar dispositivo.');
      return false;
    } catch (_) {
      addToast('warning', 'Não foi possível conectar ao servidor.');
      return false;
    }
  };

  const handleDeleteDevice = async (id) => {
    if (user?.role !== 'admin') {
      addToast('warning', 'Acesso Negado: Apenas Administradores podem excluir dispositivos.');
      return false;
    }
    try {
      const res = await authFetch(`${API_URL}/api/devices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('success', 'Dispositivo removido do monitoramento.');
        const refreshed = await authFetch(`${API_URL}/api/devices`);
        if (refreshed.ok) setDevices(await refreshed.json());
        return true;
      }
      return false;
    } catch (_) {
      addToast('warning', 'Não foi possível remover o dispositivo.');
      return false;
    }
  };

  const handleUpdateDevice = async (id, data) => {
    if (user?.role !== 'admin') {
      addToast('warning', 'Acesso Negado: Apenas Administradores podem editar dispositivos.');
      return false;
    }
    try {
      const res = await authFetch(`${API_URL}/api/devices/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
      });
      if (res.ok) {
        addToast('success', 'Dispositivo atualizado com sucesso.');
        const refreshed = await authFetch(`${API_URL}/api/devices`);
        if (refreshed.ok) setDevices(await refreshed.json());
        return true;
      }
      return false;
    } catch (_) {
      addToast('warning', 'Não foi possível atualizar o dispositivo.');
      return false;
    }
  };

  const handleUpdateInterval = async (newInterval) => {
    if (user?.role !== 'admin') {
      addToast('warning', 'Acesso Negado: Apenas Administradores podem alterar configurações.');
      return false;
    }
    try {
      const res = await authFetch(`${API_URL}/api/settings`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ interval: newInterval })
      });
      if (res.ok) {
        addToast('success', `Intervalo de atualização alterado para ${newInterval}s.`);
        return true;
      }
      return false;
    } catch (_) {
      addToast('warning', 'Não foi possível atualizar o intervalo de varredura.');
      return false;
    }
  };

  const handleStartScan = (startIp, endIp, cidr, scanPorts) => {
    if (user?.role !== 'admin') {
      addToast('warning', 'Acesso Negado: Apenas Administradores podem realizar varreduras de IP.');
      return;
    }
    if (wsRef.current && wsStatus === 'connected') {
      wsRef.current.send(JSON.stringify({ type: 'start-scan', startIp, endIp, cidr, scanPorts }));
    } else {
      addToast('warning', 'Conexão com o servidor indisponível. Não é possível iniciar a varredura.');
    }
  };

  // Se o usuário não estiver autenticado, renderiza a tela de Login
  if (!token || !user) {
    return (
      <>
        <LoginView apiUrl={API_URL} onLoginSuccess={handleLoginSuccess} />
        <ToastContainer toasts={toasts} setToasts={setToasts} />
      </>
    );
  }

  const monitoredIps = devices.map(d => d.ip);

  return (
    <div className="min-h-screen bg-main flex flex-col lg:flex-row">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        wsStatus={wsStatus}
        theme={theme}
        onToggleTheme={toggleTheme}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        unreadAlerts={unreadAlerts}
        onOpenCommandPalette={handleOpenCommandPalette}
        onOpenHelpModal={handleOpenHelpModal}
        onOpenAboutModal={handleOpenAboutModal}
        user={user}
        onLogout={handleLogout}
      />

      {/* Header bar mobile para abrir menu */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-adaptive-border glass-panel sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-xl text-adaptive-secondary hover:text-adaptive-primary hover:bg-slate-800/40 border border-adaptive-border"
            title="Abrir Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span className="font-display font-bold text-base text-adaptive-primary">NetMonitor</span>
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {activeTab === 'dashboard' ? 'Monitoramento'
            : activeTab === 'scanner' ? 'Varredura'
            : activeTab === 'analytics' ? 'Analytics'
            : 'Alertas'}
        </span>
      </header>

      <main className="flex-1 lg:pl-64 min-h-screen w-full">
        <div key={activeTab} className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10 animate-tab-enter">
          {activeTab === 'dashboard' ? (
            <Dashboard
              devices={devices}
              onAddDevice={handleAddDevice}
              onDeleteDevice={handleDeleteDevice}
              onUpdateDevice={handleUpdateDevice}
              pingInterval={pingInterval}
              onUpdateInterval={handleUpdateInterval}
              serverLimits={serverLimits}
              apiUrl={API_URL}
              userRole={user.role}
            />
          ) : activeTab === 'scanner' ? (
            <NetworkScanner
              scanState={scanState}
              onStartScan={handleStartScan}
              onAddDevice={handleAddDevice}
              monitoredIps={monitoredIps}
              networkInfo={networkInfo}
              userRole={user.role}
            />
          ) : activeTab === 'analytics' ? (
            <AnalyticsView
              devices={devices}
              apiUrl={API_URL}
              authFetch={authFetch}
            />
          ) : (
            <AlertsHistory
              apiUrl={API_URL}
              onUnreadCountChange={setUnreadAlerts}
              authFetch={authFetch}
              userRole={user.role}
            />
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} setToasts={setToasts} />

      {/* Modais de Command Palette & Ajuda de Atalhos */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        devices={devices}
        setActiveTab={setActiveTab}
        onToggleTheme={toggleTheme}
        theme={theme}
        onOpenHelpModal={handleOpenHelpModal}
        onOpenAboutModal={handleOpenAboutModal}
      />

      <KeyboardHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />
    </div>
  );
}
