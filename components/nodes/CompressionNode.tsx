import React, { useMemo, useState } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode } from '../../types';
import { Minimize2, Loader2, Download, Upload, ArrowRight, Settings2, X, FileImage, AlertTriangle } from 'lucide-react';

export const CompressionNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();
  const [isDragging, setIsDragging] = useState(false);

  // Default values
  const format = data.compressionFormat || 'image/webp';
  const quality = data.compressionQuality ?? 0.8;
  const scale = data.compressionScale ?? 1.0;
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            data.setUploadedImage?.(reader.result);
            // Reset result when new image uploaded
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
    const connection = edges.find(e => e.target === id && e.targetHandle === 'image');
    if (connection) {
        const sourceNode = nodes.find(n => n.id === connection.source) as AppNode;
        return sourceNode?.data.image || sourceNode?.data.uploadedImage || sourceNode?.data.referenceImages?.[0];
    }
    return undefined;
  }, [edges, nodes, id, data.uploadedImage]);

  const displayImage = data.image || inputImage;
  const hasResult = !!data.image;

  const downloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayImage) return;
    const ext = format.split('/')[1];
    const link = document.createElement('a');
    link.href = displayImage;
    link.download = `compressed-${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearUploadedImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.setUploadedImage?.(undefined);
      if (data.onSelectImage) data.onSelectImage('');
  };

  // Helper to parse size string (e.g. "1.2 MB" -> 1.2) for comparison
  const isSizeIncreased = useMemo(() => {
      if (!data.originalSize || !data.compressedSize) return false;
      const parse = (s: string) => {
          const num = parseFloat(s);
          if (s.includes('GB')) return num * 1024 * 1024;
          if (s.includes('MB')) return num * 1024;
          if (s.includes('KB')) return num;
          return 0;
      };
      return parse(data.compressedSize) > parse(data.originalSize);
  }, [data.originalSize, data.compressedSize]);

  return (
    <NodeWrapper 
      title="图片压缩 (Compress)" 
      selected={selected} 
      inputs={[{ id: 'image', label: '原图' }]}
      outputs={[{ id: 'image', label: '压缩图' }]}
      colorClass="border-teal-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-3 h-full min-w-[260px]">
        
        <div 
            className={`relative flex-1 min-h-0 w-full bg-black/40 rounded-md overflow-hidden border flex items-center justify-center group shrink-0 transition-colors ${isDragging ? 'border-teal-400 bg-teal-900/20' : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{ minHeight: '160px' }}
        >
           {isDragging && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                 <span className="text-teal-400 font-bold text-sm">释放上传图片</span>
             </div>
           )}

           {displayImage ? (
             <>
                <img src={displayImage} alt="Preview" className="w-full h-full object-contain" decoding="async" />
                <button 
                    onClick={downloadImage}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="下载图片"
                >
                    <Download size={14} />
                </button>
                {data.uploadedImage && !hasResult && (
                    <button 
                        onClick={clearUploadedImage}
                        className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="移除图片"
                    >
                        <X size={12} />
                    </button>
                )}
             </>
           ) : (
             <label className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full h-full hover:bg-white/5 transition-colors p-4">
                <FileImage className="text-gray-600" size={24} />
                <span className="text-xs text-gray-500 text-center">拖入图片或点击上传</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
             </label>
           )}
           
           {data.isLoading && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10">
               <div className="flex flex-col items-center">
                 <Loader2 className="animate-spin text-teal-400 mb-2" size={32} />
                 <span className="text-xs text-teal-400 font-medium">压缩中...</span>
               </div>
             </div>
           )}
        </div>

        {/* Compression Statistics */}
        {hasResult && data.originalSize && data.compressedSize && (
            <div className={`flex items-center justify-between px-3 py-2 rounded border text-[10px] transition-colors ${isSizeIncreased ? 'bg-red-900/20 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
                <div className="flex flex-col">
                    <span className="text-gray-500">原始大小</span>
                    <span className="text-gray-300 font-mono">{data.originalSize}</span>
                </div>
                <ArrowRight size={12} className={isSizeIncreased ? "text-red-500" : "text-teal-400"} />
                <div className="flex flex-col items-end">
                    <span className={isSizeIncreased ? "text-red-400" : "text-teal-400"}>
                        {isSizeIncreased ? '体积变大' : '压缩后'}
                    </span>
                    <span className="text-white font-bold font-mono">{data.compressedSize}</span>
                </div>
            </div>
        )}
        
        {isSizeIncreased && (
            <div className="flex items-center gap-2 px-2 py-1 bg-yellow-900/20 border border-yellow-500/20 rounded text-[10px] text-yellow-500">
                <AlertTriangle size={12} />
                <span>PNG 是无损格式，通常会增加体积。建议使用 WebP 或 JPEG。</span>
            </div>
        )}

        {/* Settings */}
        <div className="bg-white/5 p-2 rounded border border-white/10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] text-gray-400 pb-1 border-b border-white/5 mb-1">
                <Settings2 size={10} />
                <span className="font-bold">参数设置 (Settings)</span>
            </div>
            
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-400">格式</span>
                <select 
                    className="bg-black/40 border border-white/20 rounded text-[10px] text-gray-200 px-2 py-1 outline-none w-[110px]"
                    value={format}
                    onChange={(e) => data.setCompressionFormat?.(e.target.value as any)}
                    disabled={data.isLoading}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <option value="image/webp">WebP (推荐)</option>
                    <option value="image/jpeg">JPEG (体积小)</option>
                    <option value="image/png">PNG (无损/变大)</option>
                </select>
            </div>

            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-400">尺寸缩放</span>
                <select 
                    className="bg-black/40 border border-white/20 rounded text-[10px] text-gray-200 px-2 py-1 outline-none w-[110px]"
                    value={scale}
                    onChange={(e) => data.setCompressionScale?.(parseFloat(e.target.value))}
                    disabled={data.isLoading}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <option value={1.0}>100% (原大)</option>
                    <option value={0.75}>75%</option>
                    <option value={0.5}>50% (半大)</option>
                    <option value={0.25}>25%</option>
                </select>
            </div>

            {format !== 'image/png' && (
                <div className="flex flex-col gap-1">
                     <div className="flex justify-between">
                         <span className="text-[10px] text-gray-400">质量 (Quality)</span>
                         <span className="text-[10px] text-gray-200">{Math.round(quality * 100)}%</span>
                     </div>
                     <input 
                        type="range" min="0.1" max="1.0" step="0.1"
                        value={quality}
                        onChange={(e) => data.setCompressionQuality?.(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                        onPointerDown={(e) => e.stopPropagation()}
                        disabled={data.isLoading}
                     />
                </div>
            )}
        </div>

        {data.error && (
            <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-900/50 break-words shrink-0">
                {data.error}
            </div>
        )}

        <button 
          className="nodrag flex items-center justify-center gap-2 w-full py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          onClick={data.onRun}
          disabled={data.isLoading}
        >
          <Minimize2 size={14} />
          {data.isLoading ? '压缩中...' : '开始压缩'}
        </button>
      </div>
    </NodeWrapper>
  );
};