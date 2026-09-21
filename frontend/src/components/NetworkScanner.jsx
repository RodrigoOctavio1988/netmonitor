/**
 * NetworkScanner.jsx — NetMonitor v2.0.0
 *
 * Melhorias implementadas:
 * #3  Suporte a CIDR (ex: 192.168.1.0/24) e range multi-octeto
 * #11 Scan de portas comuns opcional (checkbox na UI)
 */
import React, { useState, useEffect } from 'react';
import { ScanLine, Play, Loader2, Plus, CheckCircle, Globe, Network, Cpu, Wifi } from 'lucide-react';

const SERVICE_NAMES = {
  21:   'FTP',
  22:   'SSH',
  23:   'Telnet',
  25:   'SMTP',
  53:   'DNS',
  80:   'HTTP',
  443:  'HTTPS',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  8080: 'HTTP-Alt',
  8443: 'HTTPS-Alt'
};

export default function NetworkScanner({ scanState, onStartScan, onAddDevice, monitoredIps, networkInfo, userRole = 'admin' }) {
  const [startIp,   setStartIp]   = useState('192.168.1.1');
  const [endIp,     setEndIp]     = useState('192.168.1.25');
  const [cidr,      setCidr]      = useState('');              // #3
  const [useCidr,   setUseCidr]   = useState(false);          // #3
  const [scanPorts, setScanPorts] = useState(false);           // #11
  const [errorMsg,  setErrorMsg]  = useState('');

  // Atualiza a faixa quando as infos da rede são carregadas
  useEffect(() => {
    if (networkInfo?.startIp && networkInfo?.endIp) {
      setStartIp(networkInfo.startIp);
      setEndIp(networkInfo.endIp);
      // Sugere CIDR baseado na rede detectada
      if (networkInfo.localIp) {
        const parts = networkInfo.localIp.split('.');
        if (parts.length === 4) {
          setCidr(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`);
        }
      }
    }
  }, [networkInfo]);

  const handleStartScan = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (useCidr) {
      // Valida CIDR
      const cidrPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/([1-9]|[1-2][0-9]|3[0-2])$/;
      if (!cidrPattern.test(cidr.trim())) {
        setErrorMsg('Por favor, insira uma notação CIDR válida (ex: 192.168.1.0/24).');
        return;
      }
      const prefix = parseInt(cidr.split('/')[1], 10);
      if (prefix < 20) {
        setErrorMsg('Por segurança, use prefixos /20 ou maiores (máx. 4096 IPs).');
        return;
      }
    } else {
      const ipPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipPattern.test(startIp) || !ipPattern.test(endIp)) {
        setErrorMsg('Por favor, insira IPs válidos.');
        return;
      }
    }

    onStartScan(useCidr ? null : startIp, useCidr ? null : endIp, useCidr ? cidr : null, scanPorts);
  };

  const isScanning = scanState.status === 'scanning';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl text-adaptive-primary">Varredura de Rede (Scan)</h2>
        <p className="text-adaptive-secondary text-sm mt-1">Escanear sub-rede local para identificar dispositivos ativos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna de configuração */}
        <div className="lg:col-span-1 space-y-5">

          {/* Configuração de faixa */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="font-display font-semibold text-base text-adaptive-primary mb-4 flex items-center gap-2">
              <ScanLine className="h-4.5 w-4.5 text-blue-400" />
              Configurar Faixa de IP
            </h3>

            {/* #3 — Toggle CIDR / Range manual */}
            <div className="flex items-center gap-2 mb-4 p-2 glass-card rounded-xl">
              <button
                onClick={() => setUseCidr(false)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${!useCidr ? 'bg-blue-600 text-white' : 'text-adaptive-secondary hover:text-adaptive-primary'}`}
              >
                Range Manual
              </button>
              <button
                onClick={() => setUseCidr(true)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${useCidr ? 'bg-blue-600 text-white' : 'text-adaptive-secondary hover:text-adaptive-primary'}`}
              >
                Notação CIDR
              </button>
            </div>

            <form onSubmit={handleStartScan} className="space-y-4">
              {useCidr ? (
                /* #3 — Campo CIDR */
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-adaptive-secondary">
                    Sub-rede CIDR
                    <span className="text-adaptive-secondary font-normal ml-1">(multi-octeto)</span>
                  </label>
                  <input
                    type="text"
                    value={cidr}
                    onChange={e => setCidr(e.target.value)}
                    disabled={isScanning}
                    className="w-full px-3 py-2 text-sm rounded-xl glass-input disabled:opacity-50 font-mono"
                    placeholder="ex: 192.168.1.0/24"
                  />
                  <p className="text-[10px] text-adaptive-secondary">
                    Aceita ranges /20 a /32. Suporta variação em múltiplos octetos.
                  </p>
                </div>
              ) : (
                /* Range manual */
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-adaptive-secondary">IP Inicial</label>
                    <input
                      type="text"
                      value={startIp}
                      onChange={e => setStartIp(e.target.value)}
                      disabled={isScanning}
                      className="w-full px-3 py-2 text-sm rounded-xl glass-input disabled:opacity-50 font-mono"
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-adaptive-secondary">IP Final</label>
                    <input
                      type="text"
                      value={endIp}
                      onChange={e => setEndIp(e.target.value)}
                      disabled={isScanning}
                      className="w-full px-3 py-2 text-sm rounded-xl glass-input disabled:opacity-50 font-mono"
                      placeholder="192.168.1.254"
                    />
                  </div>
                </>
              )}

              {/* #11 — Opção de scan de portas */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                scanPorts
                  ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                  : 'bg-slate-900/20 border-adaptive-border hover:border-slate-700/60'
              } ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={scanPorts}
                  onChange={e => setScanPorts(e.target.checked)}
                  disabled={isScanning}
                  className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 h-4 w-4 mt-0.5 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-adaptive-primary">Scan de Portas</span>
                    <span className="text-[9px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">NOVO</span>
                  </div>
                  <p className="text-[10px] text-adaptive-secondary mt-0.5">
                    Detecta serviços abertos: HTTP, SSH, RDP, FTP, etc.
                  </p>
                  {scanPorts && (
                    <p className="text-[10px] text-amber-400 mt-1">⚠ Varredura mais lenta</p>
                  )}
                </div>
              </label>

              {errorMsg && <p className="text-rose-400 text-xs font-medium">{errorMsg}</p>}

              <button
                type="submit"
                disabled={isScanning}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:bg-blue-800/40 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2"
              >
                {isScanning ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Varrendo ({scanState.progress}%)</>
                ) : (
                  <><Play className="h-4 w-4" />Iniciar Varredura</>
                )}
              </button>
            </form>
          </div>

          {/* Guia rápida */}
          <div className="glass-card p-5 rounded-2xl text-xs space-y-3.5 border-slate-800/40 bg-slate-900/10">
            <h4 className="font-semibold text-adaptive-primary flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-blue-400" />
              Como funciona?
            </h4>
            <div className="space-y-2 text-adaptive-secondary leading-relaxed">
              <p>📡 Envia pings paralelos para cada IP na faixa configurada.</p>
              <p>✅ Dispositivos que respondem são listados em tempo real.</p>
              <p>🔍 Com <strong className="text-adaptive-primary">CIDR</strong>, você pode varrer múltiplos octetos (ex: /23 = 510 IPs).</p>
              <p>🔌 Com <strong className="text-adaptive-primary">Scan de Portas</strong>, detecta serviços HTTP, SSH, RDP e outros.</p>
            </div>
            {networkInfo?.localIp && (
              <div className="flex items-center gap-2 pt-1 border-t border-adaptive-border">
                <Wifi className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                <span className="text-adaptive-secondary">Seu IP local: <span className="font-mono text-blue-400">{networkInfo.localIp}</span></span>
              </div>
            )}
          </div>
        </div>

        {/* Coluna de resultados */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5 rounded-2xl min-h-[400px] flex flex-col">
            {/* Barra de progresso */}
            {isScanning && (
              <div className="border-b border-adaptive-border pb-5 mb-5 space-y-3">
                <div className="flex justify-between text-xs text-adaptive-secondary">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                    Varrendo{scanPorts ? ' + portas' : ''}...
                  </span>
                  <span className="font-mono font-bold text-adaptive-primary">
                    {scanState.scanned} / {scanState.total} IPs
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-adaptive-border">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${scanState.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Resultados */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-semibold text-base text-adaptive-primary">Dispositivos Encontrados</h3>
                <span className="text-xs text-adaptive-secondary font-medium">
                  {scanState.foundDevices.length} ativos nesta busca
                </span>
              </div>

              {scanState.foundDevices.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center text-adaptive-secondary border border-dashed border-slate-800/80 rounded-xl bg-slate-950/10">
                  {isScanning ? (
                    <>
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
                      <p className="text-sm font-medium">Testando faixa de IPs...</p>
                      <p className="text-xs mt-1 text-adaptive-secondary">Dispositivos descobertos aparecerão aqui em tempo real.</p>
                    </>
                  ) : (
                    <>
                      <ScanLine className="h-8 w-8 mb-3 opacity-30" />
                      <p className="text-sm font-medium">Nenhuma varredura ativa</p>
                      <p className="text-xs mt-1">Configure uma faixa de IP à esquerda e inicie.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-adaptive-border text-adaptive-secondary font-semibold uppercase tracking-wider">
                        <th className="pb-3 pl-2">Endereço IP</th>
                        <th className="pb-3">Hostname</th>
                        <th className="pb-3">RTT</th>
                        {/* #11 — Coluna de portas */}
                        <th className="pb-3">Serviços Detectados</th>
                        <th className="pb-3 text-right pr-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {scanState.foundDevices.map((device, idx) => {
                        const isAlreadyMonitored = monitoredIps.includes(device.ip);
                        return (
                          <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                            <td className="py-3 pl-2 font-mono font-medium text-adaptive-primary">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 status-dot-green flex-shrink-0" />
                                {device.ip}
                              </span>
                            </td>
                            <td className="py-3 text-adaptive-secondary font-mono max-w-[150px] truncate" title={device.hostname}>
                              {device.hostname || 'Desconhecido'}
                            </td>
                            <td className="py-3 text-adaptive-secondary font-mono">{device.rtt}</td>

                            {/* #11 — Portas abertas */}
                            <td className="py-3">
                              {device.openPorts && device.openPorts.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {device.openPorts.map(p => (
                                    <span
                                      key={p}
                                      title={`Porta ${p} aberta`}
                                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono"
                                    >
                                      {SERVICE_NAMES[p] || p}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-adaptive-secondary text-[10px]">
                                  {scanPorts ? '—' : 'N/A'}
                                </span>
                              )}
                            </td>

                            <td className="py-3 text-right pr-2">
                              {isAlreadyMonitored ? (
                                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                                  <CheckCircle className="h-3.5 w-3.5" /> Monitorando
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    let inferredCat = 'Outros';
                                    const h = (device.hostname || '').toLowerCase();
                                    const ports = device.openPorts || [];
                                    if (h.includes('router') || h.includes('gateway') || h.includes('gw')) {
                                      inferredCat = 'Roteadores';
                                    } else if (h.includes('switch') || h.includes('sw')) {
                                      inferredCat = 'Switches';
                                    } else if (h.includes('cam') || h.includes('dvr') || h.includes('nvr')) {
                                      inferredCat = 'Câmeras IP';
                                    } else if (ports.includes(80) || ports.includes(443) || ports.includes(22) || ports.includes(3306) || ports.includes(5432)) {
                                      inferredCat = 'Servidores';
                                    }

                                    onAddDevice({
                                      ip:       device.ip,
                                      name:     device.hostname !== 'Desconhecido'
                                        ? device.hostname
                                        : `Dispositivo ${device.ip.split('.').pop()}`,
                                      critical: false,
                                      category: inferredCat,
                                      ...(device.openPorts?.includes(80)  ? { port: 80  } :
                                          device.openPorts?.includes(443) ? { port: 443 } :
                                          device.openPorts?.includes(22)  ? { port: 22  } :
                                          {})
                                    });
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-semibold bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg border border-blue-500/20 hover:border-transparent transition-all flex items-center gap-1 ml-auto"
                                >
                                  <Plus className="h-3 w-3" /> Monitorar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-adaptive-border pt-4 mt-6 text-[10px] text-adaptive-secondary font-mono flex justify-between items-center">
              <span>
                Scanner: {scanState.status === 'idle' ? 'Inativo' : scanState.status === 'scanning' ? 'Varrendo...' : 'Concluído'}
                {scanPorts && scanState.status !== 'idle' ? ' + portas' : ''}
              </span>
              {scanState.status === 'complete' && (
                <span className="text-emerald-400 font-semibold">✓ Varredura Finalizada!</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
