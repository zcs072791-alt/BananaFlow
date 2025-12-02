import React, { useMemo, useState } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode } from '../../types';
import { ScanText, Loader2, Image as ImageIcon, Upload, FileText, X, Copy, Check } from 'lucide-react';

export const ImageToTextNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Restore Local Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            data.setUploadedImage?.(reader.result);
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
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const inputImage = useMemo(() => {
    const connection = edges.find(e => e.target === id && e.targetHandle === 'image');
    if (connection) {
        const sourceNode = nodes.find(n => n.id === connection.source) as AppNode;
        return sourceNode?.data.image;
    }
    return data.uploadedImage;
  }, [edges, nodes, id, data.uploadedImage]);

  const clearUploadedImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.setUploadedImage?.(undefined);
  };

  const handleCopy = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.text) {
          navigator.clipboard.writeText(data.text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  return (
    <NodeWrapper 
      title="提示词提取" 
      selected={selected} 
      inputs={[{ id: 'image', label: '输入图片' }]}
      outputs={[{ id: 'text', label: '提取文本' }]}
      colorClass="border-cyan-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-3 h-full min-w-[250px]">
        
        <div 
            className={`relative min-h-[120px] w-full bg-black/40 rounded-md overflow-hidden border flex items-center justify-center group shrink-0 transition-colors ${isDragging ? 'border-cyan-400 bg-cyan-900/20' : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
           {isDragging && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                 <span className="text-cyan-400 font-bold text-sm">释放上传图片</span>
             </div>
           )}

           {inputImage ? (
             <>
                <img src={inputImage} alt="Input" className="w-full h-full object-contain max-h-[150px]" decoding="async" />
                {!edges.some(e => e.target === id && e.targetHandle === 'image') && (
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
                <ImageIcon className="text-gray-600" size={24} />
                <span className="text-xs text-gray-500 text-center">拖入图片或点击上传</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
             </label>
           )}
        </div>

        <div className="flex flex-col gap-1 flex-1 min-h-0">
            <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-bold px-1">
                <div className="flex items-center gap-1">
                    <FileText size={10} />
                    <span>Generated Prompt</span>
                </div>
                {data.text && (
                    <button 
                        onClick={handleCopy}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                        title="复制内容"
                    >
                        {copied ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}
                    </button>
                )}
            </div>
            <textarea 
                className="nodrag nopan w-full flex-1 bg-black/20 border border-white/10 rounded p-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500 resize-none custom-scrollbar cursor-text select-text"
                value={data.text || ''}
                readOnly
                placeholder="提取的提示词将显示在这里..."
                onPointerDown={(e) => e.stopPropagation()}
            />
        </div>

        {data.error && (
            <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-900/50 break-words shrink-0">
                {data.error}
            </div>
        )}

        <button 
          className="nodrag flex items-center justify-center gap-2 w-full py-2 bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          onClick={data.onRun}
          disabled={data.isLoading}
        >
          {data.isLoading ? <Loader2 size={14} className="animate-spin" /> : <ScanText size={14} />}
          {data.isLoading ? '提取中...' : '提取提示词'}
        </button>
      </div>
    </NodeWrapper>
  );
};