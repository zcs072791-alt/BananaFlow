import React, { useMemo, useState } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode } from '../../types';
import { Expand, Loader2, Download, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2, Check, Undo2, Ratio, RotateCcw, X, Upload } from 'lucide-react';

export const OutpaintNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();
  const [isDragging, setIsDragging] = useState(false);
  
  // Restore Local Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            data.setUploadedImage?.(reader.result);
            if (data.onSelectImage) data.onSelectImage('');
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                data.setUploadedImage?.(reader.result);
                if (data.onSelectImage) data.onSelectImage('');
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const inputImage = useMemo(() => {
      if (data.uploadedImage) return data.uploadedImage;
      const inputEdge = edges.find(e => e.target === id && e.targetHandle === 'image');
      if (inputEdge) {
          const sourceNode = nodes.find(n => n.id === inputEdge.source) as AppNode;
          return sourceNode?.data.image || sourceNode?.data.uploadedImage || sourceNode?.data.referenceImages?.[0];
      }
      return undefined;
  }, [edges, nodes, id, data.uploadedImage]);

  const displayImage = data.image || inputImage;
  const hasResult = !!data.image;
  const canUndo = data.history && data.history.length > 0;
  const hasInputConnection = edges.some(e => e.target === id && e.targetHandle === 'image');
  const isReady = !!data.uploadedImage || hasInputConnection;

  const downloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayImage) return;
    const link = document.createElement('a');
    link.href = displayImage;
    link.download = `outpaint-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDirection = (direction: string) => {
      if (data.setDirection) data.setDirection(direction);
      if (data.onRun) data.onRun({ direction });
  };
  
  const handleApply = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.onApplyChange?.();
  }
  
  const handleUndo = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.onUndoChange?.();
  }

  const handleClearResult = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.onSelectImage?.('');
  }

  const handleClearUploadedImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.setUploadedImage?.(undefined);
  }

  return (
    <NodeWrapper 
      title="图片扩展 (Outpaint)" 
      selected={selected} 
      inputs={[
        { id: 'image', label: '原图' },
        { id: 'prompt', label: '提示词 (可选)' }
      ]}
      outputs={[{ id: 'image', label: '扩展图' }]}
      colorClass="border-indigo-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-3 h-full min-w-[260px]">
        <div 
            className={`relative flex-1 min-h-0 w-full bg-black/40 rounded-md overflow-hidden border flex items-center justify-center group min-h-[180px] transition-colors ${isDragging ? 'border-indigo-400 bg-indigo-900/20' : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
           {isDragging && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                 <span className="text-indigo-400 font-bold text-sm">释放上传图片</span>
             </div>
           )}

           {displayImage ? (
             <>
                <img src={displayImage} alt="Display" className="w-full h-full object-contain" decoding="async" />
                <div className="absolute top-2 right-2 flex gap-1 z-20">
                    {hasResult && (
                        <>
                            <button 
                                className="p-1.5 bg-green-600/90 hover:bg-green-500 rounded-full text-white transition-colors nodrag shadow-lg shadow-green-900/50"
                                onClick={handleApply}
                                title="应用并继续 (Apply)"
                            >
                                <Check size={12} strokeWidth={3} />
                            </button>
                            <button 
                                className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                                onClick={handleClearResult}
                                title="丢弃结果 (Discard)"
                            >
                                <RotateCcw size={12} />
                            </button>
                        </>
                    )}
                     {!hasResult && canUndo && (
                         <button 
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                            onClick={handleUndo}
                            title="撤销上一步 (Undo)"
                        >
                            <Undo2 size={12} />
                        </button>
                    )}
                    {!hasResult && data.uploadedImage && (
                         <button 
                             className="p-1.5 bg-red-500/80 hover:bg-red-600/80 rounded-full text-white transition-colors nodrag"
                             onClick={handleClearUploadedImage}
                             title="移除本地图片"
                        >
                            <X size={12} />
                        </button>
                    )}
                    <button 
                        onClick={downloadImage}
                        className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                    >
                        <Download size={12} />
                    </button>
                </div>
             </>
           ) : (
             <label className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full h-full hover:bg-white/5 transition-colors p-4 select-none">
                <Upload className="text-gray-600" size={32} />
                <span className="text-xs text-gray-500 block text-center">拖入图片或点击上传</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
             </label>
           )}
           
           {data.isLoading && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-20">
               <div className="flex flex-col items-center">
                 <Loader2 className="animate-spin text-indigo-400 mb-2" size={32} />
                 <span className="text-xs text-indigo-400 font-medium">扩展中...</span>
               </div>
             </div>
           )}
        </div>
        
        {data.error && (
            <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-900/50 break-words shrink-0">
                {data.error}
            </div>
        )}

        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 px-1 bg-white/5 rounded p-1 border border-white/5">
                <div className="flex items-center gap-1 text-gray-400">
                    <Ratio size={12} />
                    <span className="text-[10px]">目标比例</span>
                </div>
                <select 
                    className="bg-black/40 border border-white/20 rounded text-[10px] text-gray-200 px-2 py-1 focus:border-indigo-500 outline-none cursor-pointer flex-1 max-w-[140px]"
                    value={data.aspectRatio || "1:1"}
                    onChange={(e) => data.setAspectRatio?.(e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    disabled={data.disabled || data.isLoading}
                >
                    <option value="1:1">1:1 (正方形)</option>
                    <option value="4:3">4:3 (横屏)</option>
                    <option value="3:4">3:4 (竖屏)</option>
                    <option value="16:9">16:9 (宽屏)</option>
                    <option value="9:16">9:16 (手机)</option>
                </select>
            </div>

            <button 
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-md font-medium transition-colors text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handleDirection('zoom-out')}
                disabled={data.isLoading || !isReady}
            >
                <Maximize2 size={14} />
                全方位扩展 (Global Expand)
            </button>

            <div className="grid grid-cols-3 gap-1 px-8">
                <div className="col-start-2">
                    <button 
                        className="w-full aspect-video bg-white/5 hover:bg-indigo-600/50 rounded flex items-center justify-center transition-colors disabled:opacity-50"
                        onClick={() => handleDirection('up')}
                        disabled={data.isLoading || !isReady}
                        title="向上偏移"
                    >
                        <ArrowUp size={10} />
                    </button>
                </div>
                <div className="col-start-1 row-start-2">
                    <button 
                        className="w-full aspect-video bg-white/5 hover:bg-indigo-600/50 rounded flex items-center justify-center transition-colors disabled:opacity-50"
                        onClick={() => handleDirection('left')}
                        disabled={data.isLoading || !isReady}
                        title="向左偏移"
                    >
                        <ArrowLeft size={10} />
                    </button>
                </div>
                <div className="col-start-3 row-start-2">
                    <button 
                        className="w-full aspect-video bg-white/5 hover:bg-indigo-600/50 rounded flex items-center justify-center transition-colors disabled:opacity-50"
                        onClick={() => handleDirection('right')}
                        disabled={data.isLoading || !isReady}
                        title="向右偏移"
                    >
                        <ArrowRight size={10} />
                    </button>
                </div>
                <div className="col-start-2 row-start-3">
                    <button 
                        className="w-full aspect-video bg-white/5 hover:bg-indigo-600/50 rounded flex items-center justify-center transition-colors disabled:opacity-50"
                        onClick={() => handleDirection('down')}
                        disabled={data.isLoading || !isReady}
                        title="向下偏移"
                    >
                        <ArrowDown size={10} />
                    </button>
                </div>
            </div>
        </div>

      </div>
    </NodeWrapper>
  );
};