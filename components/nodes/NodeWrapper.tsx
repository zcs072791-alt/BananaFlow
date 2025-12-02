import React, { ReactNode } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Copy, Scissors, Trash2, Power } from 'lucide-react';

interface NodeWrapperProps {
  title: string;
  children: ReactNode;
  selected?: boolean;
  inputs?: Array<{ id: string; label?: string }>;
  outputs?: Array<{ id: string; label?: string }>;
  colorClass?: string;
  onDelete?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  disabled?: boolean;
  onToggleDisabled?: () => void;
}

export const NodeWrapper: React.FC<NodeWrapperProps> = ({
  title,
  children,
  selected,
  inputs = [],
  outputs = [],
  colorClass = "border-gray-600",
  onDelete,
  onCopy,
  onCut,
  disabled,
  onToggleDisabled
}) => {
  return (
    <div 
      className={`bg-neutral-900 rounded-lg shadow-xl border-2 flex flex-col transition-all duration-200 w-full h-full ${selected ? 'border-yellow-400 shadow-yellow-900/50' : colorClass} ${disabled ? 'opacity-60 grayscale border-neutral-700' : ''}`}
    >
      <NodeResizer 
        isVisible={selected && !disabled} 
        minWidth={250} 
        minHeight={200} 
        handleStyle={{ width: 10, height: 10, borderRadius: 5 }}
        lineStyle={{ border: 'none' }}
      />
      
      <div className={`px-4 py-2 border-b border-white/10 bg-white/5 rounded-t-lg flex items-center justify-between shrink-0 ${disabled ? 'bg-neutral-800' : ''}`}>
        <span className="font-semibold text-sm text-gray-200 tracking-wide flex items-center gap-2">
          {title}
          {disabled && <span className="text-[10px] bg-neutral-700 text-gray-400 px-1.5 py-0.5 rounded uppercase">Disabled</span>}
        </span>
        <div className="flex gap-1 nodrag pointer-events-auto">
           {onToggleDisabled && (
             <button 
               onClick={(e) => { e.stopPropagation(); onToggleDisabled(); }} 
               className={`p-1 rounded transition-colors ${disabled ? 'text-green-500 hover:bg-green-900/30' : 'text-gray-400 hover:text-red-400 hover:bg-white/10'}`}
               title={disabled ? "启用节点" : "禁用节点"}
             >
               <Power size={14} />
             </button>
           )}
           {onCopy && (
              <button 
                onClick={(e) => { e.stopPropagation(); onCopy(); }} 
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="复制节点"
              >
                <Copy size={14} />
              </button>
           )}
           {onCut && (
              <button 
                onClick={(e) => { e.stopPropagation(); onCut(); }} 
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="剪切节点"
              >
                <Scissors size={14} />
              </button>
           )}
           {onDelete && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                title="删除节点"
              >
                <Trash2 size={14} />
              </button>
           )}
        </div>
      </div>
      
      <div className={`p-3 flex-1 flex flex-col min-h-0 ${disabled ? 'pointer-events-none select-none' : ''}`}>
        {children}
      </div>

      {inputs.map((input, index) => (
        <div 
            key={input.id} 
            className="absolute left-0 flex items-center transform -translate-x-1/2 z-[100]"
            style={{ top: `${40 + (index * 30)}px` }}
        >
             <Handle
                type="target"
                position={Position.Left}
                id={input.id}
                className={`!w-3 !h-3 !bg-neutral-800 !border-2 !border-white/50 hover:!border-yellow-400 hover:!bg-yellow-400 transition-colors ${disabled ? '!bg-neutral-700 !border-neutral-600' : ''}`}
            />
            <span className="absolute left-4 text-[10px] text-gray-400 whitespace-nowrap pointer-events-none bg-black/50 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {input.label}
            </span>
        </div>
      ))}

      {outputs.map((output, index) => (
        <div 
            key={output.id} 
            className="absolute right-0 flex items-center transform translate-x-1/2 z-[100]"
            style={{ top: `${40 + (index * 30)}px` }}
        >
             <Handle
                type="source"
                position={Position.Right}
                id={output.id}
                className={`!w-3 !h-3 !bg-neutral-800 !border-2 !border-white/50 hover:!border-yellow-400 hover:!bg-yellow-400 transition-colors ${disabled ? '!bg-neutral-700 !border-neutral-600' : ''}`}
            />
            <span className="absolute right-4 text-[10px] text-gray-400 whitespace-nowrap pointer-events-none bg-black/50 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {output.label}
            </span>
        </div>
      ))}
    </div>
  );
};