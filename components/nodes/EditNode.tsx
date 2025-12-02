import React, { useState } from 'react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode } from '../../types';
import { Paintbrush, Loader2, ImagePlus, Download, X } from 'lucide-react';
import { NodeProps } from '@xyflow/react';

export const EditNode: React.FC<NodeProps<AppNode>> = ({ data, selected }) => {
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

  const displayImage = data.image || data.uploadedImage;

  const downloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayImage) return;
    const link = document.createElement('a');
    link.href = displayImage;
    link.download = `edited-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const clearUploadedImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.setUploadedImage?.(undefined);
  };

  return (
    <NodeWrapper 
      title="魔法修图" 
      selected={selected} 
      inputs={[
          { id: 'image', label: '原图' },
          { id: 'prompt', label: '修改指令' }
      ]}
      outputs={[{ id: 'image', label: '新图' }]}
      colorClass="border-blue-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-3 h-full min-w-[200px]">
        
        <div 
            className={`relative flex-1 min-h-0 w-full bg-black/40 rounded-md overflow-hidden border flex items-center justify-center group transition-colors ${isDragging ? 'border-blue-400 bg-blue-900/20' : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
           {isDragging && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                 <span className="text-blue-400 font-bold text-sm">释放上传原图</span>
             </div>
           )}

           {displayImage ? (
             <>
                <img src={displayImage} alt="Display" className="w-full h-full object-contain" decoding="async" />
                <button 
                    onClick={downloadImage}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="下载图片"
                >
                    <Download size={14} />
                </button>
                {data.uploadedImage && (
                    <button 
                        onClick={clearUploadedImage}
                        className="absolute top-2 left-2 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="移除本地图片"
                    >
                        <X size={12} />
                    </button>
                )}
             </>
           ) : (
             <label className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full h-full hover:bg-white/5 transition-colors p-4">
                <ImagePlus className="text-gray-600" size={32} />
                <span className="text-xs text-gray-500 block text-center">拖入图片或点击上传</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
             </label>
           )}

           {data.isLoading && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10">
               <div className="flex flex-col items-center">
                <Loader2 className="animate-spin text-blue-400 mb-2" size={32} />
                <span className="text-xs text-blue-400 font-medium">处理中...</span>
               </div>
             </div>
           )}
        </div>

         {data.error && (
            <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-900/50 break-words shrink-0">
                {data.error}
            </div>
        )}

        <div className="text-[10px] text-gray-500 px-1 leading-tight shrink-0">
           请连接图片/提示词，或直接上传<b>原图</b>。
        </div>

        <button 
          className="nodrag flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          onClick={data.onRun}
          disabled={data.isLoading}
        >
          <Paintbrush size={14} />
          {data.isLoading ? '编辑中...' : '运行编辑'}
        </button>
      </div>
    </NodeWrapper>
  );
};