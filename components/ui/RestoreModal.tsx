
import React from 'react';
import { WorkflowSnapshot } from '../../services/storageService';
import { History, Clock, FilePlus, ArrowRight } from 'lucide-react';

interface RestoreModalProps {
  isOpen: boolean;
  snapshots: WorkflowSnapshot[];
  onRestore: (snapshot: WorkflowSnapshot) => void;
  onNew: () => void;
}

export const RestoreModal: React.FC<RestoreModalProps> = ({ isOpen, snapshots, onRestore, onNew }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 px-6 py-6 border-b border-white/10 text-center">
             <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-800 border border-white/10 mb-3 shadow-lg">
                <History className="text-yellow-400" size={24} />
             </div>
             <h2 className="text-2xl font-bold text-white mb-1">欢迎回来</h2>
             <p className="text-gray-400 text-sm">我们在本地缓存中发现了您上次未完成的工作流。</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">恢复最近的会话</h3>
          
          <div className="space-y-3">
            {snapshots.map((snap, index) => (
              <button
                key={snap.id}
                onClick={() => onRestore(snap)}
                className="w-full group flex items-center gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-yellow-500/50 transition-all text-left relative overflow-hidden"
              >
                <div className={`p-2 rounded-full shrink-0 ${index === 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-700 text-gray-400'}`}>
                    <Clock size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 group-hover:text-white truncate">
                        {index === 0 ? '最新自动保存' : `历史存档 ${index + 1}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">
                        {snap.dateStr}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">
                        包含 {snap.flow.nodes.length} 个节点, {snap.flow.edges.length} 条连线
                    </div>
                </div>
                <ArrowRight size={16} className="text-gray-600 group-hover:text-yellow-400 transform group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-neutral-900 px-2 text-gray-500">或者</span>
            </div>
          </div>

          <button
            onClick={onNew}
            className="w-full py-3.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-white/10 hover:border-white/20 text-gray-300 hover:text-yellow-400 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium group shadow-sm"
          >
            <FilePlus size={16} className="group-hover:scale-110 transition-transform duration-200" />
            开始全新的创作 (Start Fresh)
          </button>
        </div>
      </div>
    </div>
  );
};
