import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Shield, Cpu, Tag, MapPin, GitBranch } from 'lucide-react';

export const CATEGORIES = [
  'Servidores',
  'Roteadores',
  'Switches',
  'Setor Financeiro',
  'Câmeras IP',
  'Impressoras',
  'Outros'
];

/**
 * EditDeviceModal — Modal de edição de dispositivo monitorado (#7)
 * Permite alterar: Nome, Categoria, Localização, Dispositivo Pai, Porta TCP e status Crítico.
 */
export default function EditDeviceModal({ device, allDevices = [], onSave, onClose }) {
  const [name,     setName]     = useState('');
  const [category, setCategory] = useState('Outros');
  const [location, setLocation] = useState('');
  const [parentId, setParentId] = useState('');
  const [critical, setCritical] = useState(false);
  const [port,     setPort]     = useState('');
  const [latencyThreshold, setLatencyThreshold] = useState('');
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const nameInputRef = useRef(null);

  // Preenche o form com os dados do dispositivo ao abrir
  useEffect(() => {
    if (device) {
      setName(device.name         || '');
      setCategory(device.category || 'Outros');
      setLocation(device.location || '');
      setParentId(device.parentId || '');
      setCritical(device.critical || false);
      setPort(device.port ? String(device.port) : '');
      setLatencyThreshold(device.latencyThreshold ? String(device.latencyThreshold) : '');
      setError('');
    }
    // Foca o campo de nome
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [device]);

  // Fecha ao pressionar Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('O nome é obrigatório.');
      return;
    }

    if (port.trim()) {
      const portVal = parseInt(port.trim(), 10);
      if (isNaN(portVal) || portVal < 1 || portVal > 65535) {
        setError('Porta TCP inválida (1–65535).');
        return;
      }
    }

    let parsedThreshold = undefined;
    if (latencyThreshold.trim()) {
      const t = parseInt(latencyThreshold.trim(), 10);
      if (isNaN(t) || t < 1 || t > 10000) {
        setError('Limite de latência inválido (1–10000 ms).');
        return;
      }
      parsedThreshold = t;
    }

    setSaving(true);
    const success = await onSave(device.id, {
      name:             name.trim(),
      category:         category || 'Outros',
      location:         location.trim(),
      parentId:         parentId || undefined,
      critical,
      port:             port.trim() || undefined,
      latencyThreshold: parsedThreshold !== undefined ? parsedThreshold : null
    });
    setSaving(false);

    if (success) {
      onClose();
    } else {
      setError('Falha ao salvar. Tente novamente.');
    }
  };

  if (!device) return null;

  // Lista de possíveis dispositivos pai (exclui o próprio dispositivo)
  const parentCandidates = allDevices.filter(d => d.id !== device.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative glass-card rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-700/60 animate-modal-enter max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20">
                <Cpu className="h-4 w-4 text-blue-400" />
              </div>
              <h3 className="font-display font-bold text-lg text-adaptive-primary">Editar Dispositivo</h3>
            </div>
            <p className="text-xs text-adaptive-secondary font-mono ml-9">{device.ip}{device.port ? `:${device.port}` : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="text-adaptive-secondary hover:text-adaptive-primary p-1.5 rounded-lg hover:bg-slate-500/10 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Nome / Identificador</label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl glass-input"
              placeholder="ex: Servidor Central"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categoria / Tag */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-blue-400" /> Categoria / Tag
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl glass-input bg-slate-900 text-slate-200"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Localização */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-blue-400" /> Localização
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl glass-input"
                placeholder="ex: Rack 01 / Recepção"
              />
            </div>
          </div>

          {/* Dispositivo Pai (Hierarquia para Topologia) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5 text-purple-400" /> Dispositivo Pai (Gateway / Switch Conectado)
            </label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl glass-input bg-slate-900 text-slate-200"
            >
              <option value="">Nenhum (Nó Raiz ou Switch Principal)</option>
              {parentCandidates.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.ip}) [{d.category || 'Geral'}]
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">Determina a hierarquia das linhas no Mapa de Topologia</p>
          </div>

          {/* Porta */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">
              Porta TCP
              <span className="text-slate-500 font-normal ml-1">(opcional — limpe para usar ICMP ping)</span>
            </label>
            <input
              type="number"
              value={port}
              onChange={e => setPort(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl glass-input"
              placeholder="ex: 80, 22, 443"
              min="1"
              max="65535"
            />
          </div>

          {/* Limite de Latência Customizável */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
              <span>Limite de Latência para Alerta (ms)</span>
              <span className="text-[11px] text-amber-400/80 font-mono">Padrão: 200 ms</span>
            </label>
            <input
              type="number"
              value={latencyThreshold}
              onChange={e => setLatencyThreshold(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl glass-input"
              placeholder="ex: 50 (alerta se o ping for maior)"
              min="1"
              max="10000"
            />
            <p className="text-[11px] text-slate-500">Se o tempo de resposta exceder este limite, um alerta será disparado.</p>
          </div>

          {/* Crítico */}
          <label className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/40 hover:border-rose-500/20 hover:bg-rose-950/10 transition-all cursor-pointer select-none">
            <input
              type="checkbox"
              checked={critical}
              onChange={e => setCritical(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0 h-4 w-4 cursor-pointer"
            />
            <Shield className={`h-4 w-4 ${critical ? 'text-rose-400' : 'text-slate-500'} transition-colors`} />
            <div>
              <span className="text-sm font-medium text-adaptive-primary">Dispositivo Crítico</span>
              <p className="text-[11px] text-adaptive-secondary mt-0.5">Gera alertas prioritários e notificações do sistema</p>
            </div>
          </label>

          {/* Erro */}
          {error && (
            <p className="text-rose-400 text-xs font-medium flex items-center gap-1">
              <span>⚠</span> {error}
            </p>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-adaptive-secondary hover:text-adaptive-primary border border-adaptive-border hover:bg-slate-500/10 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
