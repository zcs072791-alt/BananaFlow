import React, { useState, useEffect } from 'react';
import { X, Key, Save } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentApiKey, onSaveApiKey }) => {
  const [keyInput, setKeyInput] = useState(currentApiKey);

  useEffect(() => {
    setKeyInput(currentApiKey);
  }, [currentApiKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(keyInput);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={18} className="text-yellow-400" />
            Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 block">Gemini API Key</label>
            <div className="relative">
                <input 
                    type="password" 
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="Enter your API Key (AIza...)"
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 transition-colors font-mono"
                />
            </div>
            <p className="text-xs text-gray-500">
                Your API Key is stored locally in your browser and is never sent to our servers.
                <br />
                Get a key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-end gap-2">
           <button 
             onClick={onClose}
             className="px-4 py-2 rounded text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
           >
             Cancel
           </button>
           <button 
             onClick={handleSave}
             className="px-4 py-2 rounded text-sm bg-yellow-600 hover:bg-yellow-500 text-white font-medium flex items-center gap-2 transition-colors"
           >
             <Save size={16} />
             Save Configuration
           </button>
        </div>
      </div>
    </div>
  );
};