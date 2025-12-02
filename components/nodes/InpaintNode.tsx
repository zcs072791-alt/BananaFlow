import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode } from '../../types';
import { Brush, Loader2, Eraser, Download, Upload, X, RotateCcw, Check, Undo2 } from 'lucide-react';

const BRUSH_COLORS = [
  '#FFFFFF', '#EF4444', '#22C55E', '#3B82F6', '#EAB308',
];

export const InpaintNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false); 
  const [isDrawing, setIsDrawing] = useState(false); 
  const [hasMask, setHasMask] = useState(false);
  const [brushColor, setBrushColor] = useState<string>(BRUSH_COLORS[1]); 
  const [brushSize, setBrushSize] = useState<number>(25);
  const [isDragging, setIsDragging] = useState(false);
  
  const updateMaskData = (isClear = false) => {
      if (isClear) {
          (data as any).setMask?.('');
          return;
      }
      const mask = getMaskDataUrl();
      if (mask && (data as any).setMask) {
          (data as any).setMask(mask);
      }
  };

  // Restore Local Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            data.setUploadedImage?.(reader.result);
            setHasMask(false);
            updateMaskData(true);
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
                setHasMask(false);
                updateMaskData(true);
                if (data.onSelectImage) data.onSelectImage('');
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const hasResult = !!data.image;
  const sourceImage = useMemo(() => {
    if (data.uploadedImage) return data.uploadedImage;
    const connection = edges.find(e => e.target === id && e.targetHandle === 'image');
    if (connection) {
        const sourceNode = nodes.find(n => n.id === connection.source) as AppNode | undefined;
        if (sourceNode?.data?.image) return sourceNode.data.image;
    }
    return undefined;
  }, [data.uploadedImage, edges, nodes, id]);

  const displayImage = hasResult ? data.image : sourceImage;

  useEffect(() => {
    if (sourceImage && !hasResult) {
        const img = new Image();
        img.onload = () => {
            if (canvasRef.current) {
                canvasRef.current.width = img.naturalWidth;
                canvasRef.current.height = img.naturalHeight;
            }
        };
        img.src = sourceImage;
    }
  }, [sourceImage, hasResult]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sourceImage || hasResult || !canvasRef.current) return;
    isDrawingRef.current = true;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.beginPath();
    ctx.moveTo(x * scaleX, y * scaleY);
    ctx.lineWidth = brushSize * Math.max(scaleX, scaleY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineTo(x * scaleX, y * scaleY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);
    if (canvasRef.current) {
        const maskUrl = getMaskDataUrl();
        if (maskUrl) {
             setHasMask(true);
             updateMaskData();
        }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.lineWidth = brushSize * Math.max(scaleX, scaleY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor; 
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineTo(x * scaleX, y * scaleY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x * scaleX, y * scaleY);
  };

  const clearMask = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        setHasMask(false);
        updateMaskData(true);
    }
  };

  const clearResult = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onSelectImage?.('');
  }
  
  const handleApply = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.onApplyChange?.();
  }
  
  const handleUndo = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.onUndoChange?.();
  }

  const getMaskDataUrl = () => {
      if (!canvasRef.current || !sourceImage) return null;
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      const strokeCanvas = document.createElement('canvas');
      strokeCanvas.width = width;
      strokeCanvas.height = height;
      const sCtx = strokeCanvas.getContext('2d');
      if (!sCtx) return null;
      sCtx.drawImage(canvasRef.current, 0, 0);
      sCtx.globalCompositeOperation = 'source-in';
      sCtx.fillStyle = '#FFFFFF';
      sCtx.fillRect(0, 0, width, height);
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = height;
      const fCtx = finalCanvas.getContext('2d');
      if (!fCtx) return null;
      fCtx.fillStyle = 'black';
      fCtx.fillRect(0, 0, width, height);
      fCtx.drawImage(strokeCanvas, 0, 0);
      return finalCanvas.toDataURL('image/png');
  };

  const clearUploadedImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.setUploadedImage?.(undefined);
      setHasMask(false);
      updateMaskData(true);
  };

  const downloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayImage) return;
    const link = document.createElement('a');
    link.href = displayImage;
    link.download = `inpaint-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const canUndo = data.history && data.history.length > 0;

  return (
    <NodeWrapper 
      title="局部重绘 (Inpaint)" 
      selected={selected} 
      inputs={[
          { id: 'image', label: '原图' },
          { id: 'prompt', label: '修改指令' }
      ]}
      outputs={[{ id: 'image', label: '结果' }]}
      colorClass="border-orange-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-3 h-full min-w-[250px]">
        <div 
            className={`relative flex-1 min-h-0 w-full bg-black/40 rounded-md overflow-hidden border flex items-center justify-center select-none group transition-colors ${isDragging ? 'border-orange-400 bg-orange-900/20' : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
           {isDragging && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                 <span className="text-orange-400 font-bold text-sm">释放更换底图</span>
             </div>
           )}

           {displayImage ? (
             <>
                <img 
                    src={displayImage} 
                    alt="Display" 
                    className="absolute inset-0 w-full h-full object-fill pointer-events-none" 
                />
                {!hasResult && (
                    <canvas 
                        ref={canvasRef}
                        className="nodrag absolute inset-0 w-full h-full cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                    />
                )}
                {!hasMask && !isDrawing && !hasResult && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/50 px-2 py-1 rounded text-[10px] text-white/80 backdrop-blur-sm">
                            在图片上涂抹区域
                        </div>
                    </div>
                )}

                 <div className="absolute top-2 right-2 flex gap-1 z-20">
                    {hasResult && (
                        <>
                            <button 
                                className="p-1.5 bg-green-600/90 hover:bg-green-500 rounded-full text-white transition-colors nodrag shadow-lg shadow-green-900/50"
                                onClick={handleApply}
                            >
                                <Check size={12} strokeWidth={3} />
                            </button>
                            <button 
                                className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                                onClick={clearResult}
                            >
                                <RotateCcw size={12} />
                            </button>
                        </>
                    )}
                    {!hasResult && hasMask && (
                        <button 
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                            onClick={clearMask}
                        >
                            <Eraser size={12} />
                        </button>
                    )}
                    {!hasResult && canUndo && (
                         <button 
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                            onClick={handleUndo}
                        >
                            <Undo2 size={12} />
                        </button>
                    )}
                    {!hasResult && data.uploadedImage && !canUndo && (
                        <button 
                             className="p-1.5 bg-red-500/80 hover:bg-red-600/80 rounded-full text-white transition-colors nodrag"
                             onClick={clearUploadedImage}
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
              <label className="flex flex-col items-center justify-center gap-1 cursor-pointer w-full h-full hover:bg-white/5 transition-colors">
                <Upload size={24} className="text-gray-600 mb-1" />
                <span className="text-xs text-gray-500 text-center">拖入图片或点击上传</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
             </label>
           )}

           {data.isLoading && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-30">
               <div className="flex flex-col items-center">
                <Loader2 className="animate-spin text-orange-400 mb-2" size={32} />
                <span className="text-xs text-orange-400 font-medium">重绘中...</span>
               </div>
             </div>
           )}
        </div>

        {!hasResult && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-white/5 rounded border border-white/10 nodrag shrink-0">
                <div className="flex gap-1">
                    {BRUSH_COLORS.map((color) => (
                    <div 
                        key={color}
                        className={`w-4 h-4 rounded-full cursor-pointer border border-white/20 transition-transform hover:scale-110 ${brushColor === color ? 'ring-1 ring-white scale-110' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={(e) => { e.stopPropagation(); setBrushColor(color); }}
                    />
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-mono w-4 text-center">{brushSize}</span>
                    <input 
                        type="range" min="5" max="100" step="5"
                        value={brushSize} 
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-16 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                </div>
            </div>
        )}

         {data.error && (
            <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-900/50 break-words shrink-0">
                {data.error}
            </div>
        )}

        <button 
          className="nodrag flex items-center justify-center gap-2 w-full py-2 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          onClick={data.onRun}
          disabled={data.isLoading}
        >
          <Brush size={14} />
          {data.isLoading ? '处理中...' : '执行重绘'}
        </button>
      </div>
    </NodeWrapper>
  );
};