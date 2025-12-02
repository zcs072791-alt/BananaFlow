import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode } from '../../types';
import { PenTool, Loader2, Eraser, Download, Trash2, RotateCcw, Upload, Check, Undo2, X, Type } from 'lucide-react';
import { NodeProps } from '@xyflow/react';

const BRUSH_COLORS = [
  '#FFFFFF', '#000000', '#EF4444', '#22C55E', '#3B82F6', '#EAB308', '#A855F7'
];

export const DrawNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDrawingRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState<string>('#FFFFFF');
  const [brushSize, setBrushSize] = useState<number>(5);
  
  // Tools: 'brush' | 'eraser' | 'text'
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser' | 'text'>('brush');
  const [textInput, setTextInput] = useState<{x: number, y: number, value: string} | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);

  // Determine Base Image (Uploaded > Connected)
  const connectedImage = useMemo(() => {
      const connection = edges.find(e => e.target === id && e.targetHandle === 'image');
      if (connection) {
          const sourceNode = nodes.find(n => n.id === connection.source) as AppNode;
          // Try to get the best available image from source
          return sourceNode?.data.image || sourceNode?.data.uploadedImage || sourceNode?.data.referenceImages?.[0] || sourceNode?.data.sketch;
      }
      return undefined;
  }, [edges, nodes, id]);

  const baseImage = data.uploadedImage || connectedImage;

  // Initialize canvas with saved stroke layer if available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if (data.strokeLayer) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = data.strokeLayer;
        } else {
             // Explicitly clear if strokeLayer is missing (e.g. on Apply or Undo)
             ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
  }, [data.strokeLayer]); 
  
  // Auto-focus input when it appears
  useEffect(() => {
      if (textInput && inputRef.current) {
          // Small delay to ensure render and prevent race conditions
          setTimeout(() => {
              inputRef.current?.focus();
          }, 10);
      }
  }, [textInput]);

  // Compositing Logic: Merges Background Image and Stroke Layer
  const saveSketch = async () => {
      if (!canvasRef.current) return;
      
      try {
          // 1. Save Strokes Layer (Transparent)
          const strokesData = canvasRef.current.toDataURL('image/png');
          data.setStrokeLayer?.(strokesData);

          // 2. Composite for Result (Sketch)
          const width = 512;
          const height = 512;
          const compositeCanvas = document.createElement('canvas');
          compositeCanvas.width = width;
          compositeCanvas.height = height;
          const ctx = compositeCanvas.getContext('2d');
          if (!ctx) return;

          // Draw Background (Black)
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);

          // Draw Base Image
          if (baseImage) {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.src = baseImage;
              await img.decode();
              
              // Calculate object-contain metrics to match CSS
              const aspectCanvas = width / height;
              const aspectImg = img.width / img.height;
              let drawW, drawH, drawX, drawY;

              if (aspectImg > aspectCanvas) {
                  // Image is wider than canvas (fit width)
                  drawW = width;
                  drawH = width / aspectImg;
                  drawX = 0;
                  drawY = (height - drawH) / 2;
              } else {
                  // Image is taller (fit height)
                  drawH = height;
                  drawW = height * aspectImg;
                  drawY = 0;
                  drawX = (width - drawW) / 2;
              }
              ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }

          // Draw Strokes
          ctx.drawImage(canvasRef.current, 0, 0, width, height);

          // Save
          data.setSketch?.(compositeCanvas.toDataURL('image/png'));
      } catch (e) {
          console.error("Failed to save sketch composite", e);
      }
  };

  // Re-composite when base image changes
  useEffect(() => {
      if (baseImage) {
          const timer = setTimeout(() => {
              saveSketch();
          }, 200);
          return () => clearTimeout(timer);
      }
  }, [baseImage]);

  const commitText = () => {
      if (!textInput || !canvasRef.current) {
          setTextInput(null);
          return;
      }
      
      if (textInput.value.trim()) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              const rect = canvas.getBoundingClientRect();
              const scaleX = canvas.width / rect.width;
              const scaleY = canvas.height / rect.height;

              // Use brush size for font size
              const fontSize = Math.max(14, brushSize * 2); 
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.fillStyle = brushColor;
              ctx.textBaseline = 'top';
              ctx.globalCompositeOperation = 'source-over';

              const finalX = textInput.x * scaleX;
              const finalY = textInput.y * scaleY;

              ctx.fillText(textInput.value, finalX, finalY);
              saveSketch();
          }
      }
      setTextInput(null);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (data.image) return; // Don't draw on result
    
    // Text Tool Logic
    if (activeTool === 'text') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const visualX = e.clientX - rect.left;
        const visualY = e.clientY - rect.top;
        
        // If there was an active input, commit it first
        if (textInput && textInput.value.trim()) {
            commitText();
        }
        
        setTextInput({ x: visualX, y: visualY, value: '' });
        return;
    }

    isDrawingRef.current = true;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Eraser uses 'destination-out' to remove stroke pixels only
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'text') return;
    if (!isDrawingRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.closePath();
        // Reset composite operation to default
        ctx!.globalCompositeOperation = 'source-over';
        saveSketch();
    }
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
      // STOP PROPAGATION to prevent ReactFlow from intercepting keys (like Backspace deleting the node)
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation(); 
      
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          commitText();
      }
      if (e.key === 'Escape') {
          setTextInput(null);
      }
  };

  const clearCanvas = (e: React.MouseEvent) => {
      e.stopPropagation();
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          saveSketch();
      }
  };
  
  const clearUploadedImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.setUploadedImage?.(undefined);
      setTimeout(() => saveSketch(), 100);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            data.setUploadedImage?.(reader.result);
            setTimeout(() => saveSketch(), 100);
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
                setTimeout(() => saveSketch(), 100);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const hasResult = !!data.image;
  const canUndo = data.history && data.history.length > 0;

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

  const downloadImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      const target = data.image || data.sketch;
      if (!target) return;
      const link = document.createElement('a');
      link.href = target;
      link.download = `draw-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <NodeWrapper 
      title="手绘生图 (Sketch)" 
      selected={selected} 
      inputs={[
          { id: 'prompt', label: '提示词' },
          { id: 'image', label: '参考图' }
      ]}
      outputs={[{ id: 'image', label: '结果图' }]}
      colorClass="border-fuchsia-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-3 h-full min-w-[280px]">
        
        <div 
            className={`relative w-full aspect-square bg-black rounded-md overflow-hidden border transition-colors ${isDragging ? 'border-fuchsia-500' : 'border-white/10'}`}
            onDragOver={onDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
        >
            {hasResult ? (
                <>
                    <img src={data.image} className="w-full h-full object-contain bg-black" alt="Result" />
                    <div className="absolute top-2 right-2 flex gap-1 z-20">
                         <button 
                            className="p-1.5 bg-green-600/90 hover:bg-green-500 rounded-full text-white transition-colors shadow-lg"
                            onClick={handleApply}
                            title="应用结果作为新底图"
                        >
                            <Check size={12} strokeWidth={3} />
                        </button>
                        <button 
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                            onClick={handleClearResult}
                            title="丢弃结果，返回绘画"
                        >
                            <RotateCcw size={12} />
                        </button>
                        <button 
                            onClick={downloadImage}
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                        >
                            <Download size={12} />
                        </button>
                    </div>
                </>
            ) : (
                <>
                    {/* Layer 1: Background Image (Uploaded or Connected) */}
                    {baseImage && (
                        <img 
                            src={baseImage} 
                            alt="Base" 
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                        />
                    )}

                    {/* Layer 2: Drawing Canvas */}
                    <canvas 
                        ref={canvasRef}
                        width={512}
                        height={512}
                        className={`absolute inset-0 w-full h-full touch-none nodrag z-10 ${activeTool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                    />
                    
                    {/* Layer 3: Text Input Overlay */}
                    {textInput && (
                        <input
                            ref={inputRef}
                            autoFocus
                            type="text"
                            // nopan is CRITICAL here to allow text selection and typing without dragging the canvas
                            className="absolute z-50 bg-neutral-800/90 border border-fuchsia-500 text-white p-1 rounded-sm shadow-xl nodrag nopan"
                            style={{ 
                                left: textInput.x, 
                                top: textInput.y, 
                                color: brushColor,
                                textShadow: '0 1px 2px black', // Make text visible even on white bg if brush is white
                                fontSize: `${Math.max(12, brushSize * 2)}px`,
                                minWidth: '120px',
                                outline: 'none'
                            }}
                            value={textInput.value}
                            onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                            onKeyDown={handleTextKeyDown}
                            onBlur={commitText}
                            // Stop ALL mouse/pointer events from bubbling to ReactFlow
                            onMouseDown={(e) => e.stopPropagation()} 
                            onMouseUp={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                        />
                    )}
                     
                    {/* Drawing Controls Overlay */}
                    <div className="absolute top-2 right-2 flex gap-1 z-20">
                         {canUndo && (
                             <button 
                                className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                                onClick={handleUndo}
                                title="撤销"
                            >
                                <Undo2 size={12} />
                            </button>
                         )}
                        
                        {data.uploadedImage && (
                            <button 
                                className="p-1.5 bg-red-500/80 hover:bg-red-600/80 rounded-full text-white transition-colors"
                                onClick={clearUploadedImage}
                                title="移除底图"
                            >
                                <X size={12} />
                            </button>
                        )}

                        <button 
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                            onClick={clearCanvas}
                            title="清空笔迹"
                        >
                            <Trash2 size={12} />
                        </button>
                        <label className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors cursor-pointer" title="上传底图">
                             <Upload size={12} />
                             <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                </>
            )}

             {data.isLoading && (
                 <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-30">
                   <div className="flex flex-col items-center">
                     <Loader2 className="animate-spin text-fuchsia-400 mb-2" size={32} />
                     <span className="text-xs text-fuchsia-400 font-medium">生成中...</span>
                   </div>
                 </div>
            )}
        </div>

        {/* Toolbar */}
        {!hasResult && (
            <div className="flex flex-col gap-2 p-2 bg-white/5 rounded border border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                        {BRUSH_COLORS.map(c => (
                            <button
                                key={c}
                                className={`w-4 h-4 rounded-full border border-white/20 ${(brushColor === c && activeTool !== 'eraser') ? 'ring-2 ring-white scale-110' : ''}`}
                                style={{ backgroundColor: c }}
                                onClick={() => { setBrushColor(c); if(activeTool === 'eraser') setActiveTool('brush'); }}
                            />
                        ))}
                    </div>
                    <div className="flex gap-1">
                         <button 
                            className={`p-1 rounded transition-colors ${activeTool === 'text' ? 'bg-fuchsia-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}
                            onClick={() => setActiveTool(activeTool === 'text' ? 'brush' : 'text')}
                            title="添加文字"
                        >
                            <Type size={14} />
                        </button>
                        <button 
                            className={`p-1 rounded transition-colors ${activeTool === 'eraser' ? 'bg-fuchsia-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}
                            onClick={() => setActiveTool(activeTool === 'eraser' ? 'brush' : 'eraser')}
                            title="橡皮擦"
                        >
                            <Eraser size={14} />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-8">Size</span>
                    <input 
                        type="range" min="1" max="50" 
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                        onPointerDown={(e) => e.stopPropagation()}
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
          className="nodrag flex items-center justify-center gap-2 w-full py-2 bg-fuchsia-700 hover:bg-fuchsia-600 active:bg-fuchsia-800 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          onClick={data.onRun}
          disabled={data.isLoading}
        >
          <PenTool size={14} />
          {data.isLoading ? '正在生成...' : '按画生成 (Generate)'}
        </button>
      </div>
    </NodeWrapper>
  );
};