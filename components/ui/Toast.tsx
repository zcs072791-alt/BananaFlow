import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastItem: React.FC<{ toast: ToastMessage; removeToast: (id: string) => void }> = ({ toast, removeToast }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle size={18} className="text-green-500" />;
      case 'error': return <AlertCircle size={18} className="text-red-500" />;
      default: return <Info size={18} className="text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success': return 'border-green-500/50';
      case 'error': return 'border-red-500/50';
      default: return 'border-blue-500/50';
    }
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 bg-neutral-900 border ${getBorderColor()} rounded shadow-lg shadow-black/50 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-sm w-full`}>
      <div className="shrink-0">{getIcon()}</div>
      <p className="text-sm text-gray-200 flex-1 break-words leading-tight">{toast.message}</p>
      <button 
        onClick={() => removeToast(toast.id)}
        className="text-gray-500 hover:text-white transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-2 items-end">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
          ))}
      </div>
    </div>
  );
};