import React, { useEffect } from 'react';
import { ShieldAlert, X, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ToastContainer({ toasts, setToasts }) {
  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 6000); // 6 segundos

    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const getStyle = () => {
    switch (toast.type) {
      case 'danger':
        return {
          bg: 'bg-rose-950/80 border-rose-500/30 text-rose-200',
          icon: ShieldAlert,
          iconColor: 'text-rose-400',
          title: 'Dispositivo Crítico Offline'
        };
      case 'success':
        return {
          bg: 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200',
          icon: CheckCircle,
          iconColor: 'text-emerald-400',
          title: 'Dispositivo Online'
        };
      default:
        return {
          bg: 'bg-amber-950/80 border-amber-500/30 text-amber-200',
          icon: AlertTriangle,
          iconColor: 'text-amber-400',
          title: 'Alerta de Rede'
        };
    }
  };

  const style = getStyle();
  const Icon = style.icon;

  return (
    <div
      className={`pointer-events-auto flex gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-slide-in ${style.bg}`}
    >
      <div className="mt-0.5">
        <Icon className={`h-5 w-5 ${style.iconColor}`} />
      </div>
      <div className="flex-1">
        <h4 className="font-display font-semibold text-sm leading-tight text-white">{style.title}</h4>
        <p className="text-xs mt-1 text-slate-300 leading-normal">{toast.message}</p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-slate-400 hover:text-slate-200 p-0.5 rounded-lg hover:bg-white/5 h-fit self-start transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
