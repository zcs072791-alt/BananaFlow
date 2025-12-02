import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode } from '../../types';
import { Video, Loader2, Film, Download, Play, Ratio, Clapperboard, Images, Pause, FileVideo, Layers, Eraser, Focus, Upload, X, Move, Grid, RotateCcw, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const processFrameData = (
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  shouldRemoveBg: boolean, 
  shouldCenter: boolean,
  tolerance: number
): { offsetX: number, offsetY: number } => {
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  
  if (shouldRemoveBg) {
      const r0 = d[0];
      const g0 = d[1];
      const b0 = d[2];
      
      // Use tolerance for chroma key
      for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          
          // Euclidean distance for better color matching
          const dist = Math.sqrt(
              Math.pow(r - r0, 2) + 
              Math.pow(g - g0, 2) + 
              Math.pow(b - b0, 2)
          );

          if (dist < tolerance) {
              d[i + 3] = 0; 
          }
      }
      ctx.putImageData(imgData, 0, 0);
  }

  let offsetX = 0;
  let offsetY = 0;

  if (shouldCenter && shouldRemoveBg) {
      let minX = width, minY = height, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
              if (d[(y * width + x) * 4 + 3] > 20) { 
                  minY = y;
                  found = true;
                  break;
              }
          }
          if (found) break;
      }

      if (found) {
          for (let y = height - 1; y >= minY; y--) {
              let rowHasPixel = false;
              for (let x = 0; x < width; x++) {
                  if (d[(y * width + x) * 4 + 3] > 20) {
                      maxY = y;
                      rowHasPixel = true;
                      break;
                  }
              }
              if (rowHasPixel) break;
          }

          let stopLeft = false;
          for (let x = 0; x < width; x++) {
              for (let y = minY; y <= maxY; y++) {
                   if (d[(y * width + x) * 4 + 3] > 20) {
                       minX = x;
                       stopLeft = true;
                       break;
                   }
              }
              if (stopLeft) break;
          }

          let stopRight = false;
          for (let x = width - 1; x >= minX; x--) {
              for (let y = minY; y <= maxY; y++) {
                  if (d[(y * width + x) * 4 + 3] > 20) {
                      maxX = x;
                      stopRight = true;
                      break;
                  }
              }
              if (stopRight) break;
          }

          const contentW = maxX - minX;
          const contentH = maxY - minY;
          const contentCenterX = minX + contentW / 2;
          const contentCenterY = minY + contentH / 2;
          const canvasCenterX = width / 2;
          const canvasCenterY = height / 2;

          offsetX = Math.round(canvasCenterX - contentCenterX);
          offsetY = Math.round(canvasCenterY - contentCenterY);
      }
  }
  return { offsetX, offsetY };
};

export const VideoNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isProcessingGif, setIsProcessingGif] = useState(false);
  
  // Settings
  const [removeBackground, setRemoveBackground] = useState(true);
  const [keepCentered, setKeepCentered] = useState(true);
  const [tolerance, setTolerance] = useState(60); // Chroma Key Tolerance
  
  const [isDragging, setIsDragging] = useState(false);
  
  // Editing State
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null); 
  const COLS = 4;
  
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

  const videoType = data.videoType || 'sequence';
  const setVideoType = (type: 'veo' | 'sequence') => {
      if (data.setVideoType) data.setVideoType(type);
      else (data as any).videoType = type; 
  };
  
  const spriteSheets = useMemo(() => {
      if (data.spriteSheets && data.spriteSheets.length > 0) return data.spriteSheets;
      if (data.spriteSheet) return [data.spriteSheet];
      return [];
  }, [data.spriteSheets, data.spriteSheet]);

  const totalFrames = data.frameCount || (spriteSheets.length * 12);
  const numberOfSheets = spriteSheets.length || 1;
  const framesPerSheet = Math.ceil(totalFrames / numberOfSheets);
  const ROWS = Math.ceil(framesPerSheet / COLS);

  const inputImage = useMemo(() => {
      if (data.uploadedImage) return data.uploadedImage;
      const inputEdge = edges.find(e => e.target === id && e.targetHandle === 'image');
      if (inputEdge) {
          const sourceNode = nodes.find(n => n.id === inputEdge.source) as AppNode;
          return sourceNode?.data.image || sourceNode?.data.uploadedImage || sourceNode?.data.referenceImages?.[0];
      }
      return undefined;
  }, [edges, nodes, id, data.uploadedImage]);

  // Handle Editing Controls
  const toggleEditMode = () => {
      const newMode = !isEditingMode;
      setIsEditingMode(newMode);
      if (newMode) setIsPlaying(false);
      else setIsPlaying(true);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (!isEditingMode) return;
      e.stopPropagation(); // Ensure drag event doesn't propagate to node
      setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if (!isEditingMode || !dragStart || !canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      // Calculate scaling factor between visible size and internal resolution
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      
      const dx = (e.clientX - dragStart.x) * scaleX;
      const dy = (e.clientY - dragStart.y) * scaleY;
      
      setDragStart({ x: e.clientX, y: e.clientY });

      // Update offsets for current frame
      const currentOffsets = data.frameOffsets || {};
      const currentFrameOffset = currentOffsets[frameIndex] || { x: 0, y: 0 };
      const newOffset = { x: currentFrameOffset.x + dx, y: currentFrameOffset.y + dy };
      
      if (data.setFrameOffsets) {
          data.setFrameOffsets({ ...currentOffsets, [frameIndex]: newOffset });
      }
  };

  const handleCanvasMouseUp = () => {
      setDragStart(null);
  };
  
  const handleResetFrame = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.setFrameOffsets && data.frameOffsets) {
           const newOffsets = { ...data.frameOffsets };
           delete newOffsets[frameIndex];
           data.setFrameOffsets(newOffsets);
      }
  };
  
  const handleNextFrame = (e: React.MouseEvent) => {
      e.stopPropagation();
      setFrameIndex((prev) => (prev + 1) % totalFrames);
  };

  const handlePrevFrame = (e: React.MouseEvent) => {
      e.stopPropagation();
      setFrameIndex((prev) => (prev - 1 + totalFrames) % totalFrames);
  };


  useEffect(() => {
      if (videoType === 'sequence' && spriteSheets.length > 0 && canvasRef.current) {
          const sheetIndex = Math.floor(frameIndex / framesPerSheet);
          const localFrameIndex = frameIndex % framesPerSheet;
          const currentSheetSrc = spriteSheets[sheetIndex] || spriteSheets[0];
          if (!currentSheetSrc) return;

          const img = new Image();
          img.crossOrigin = "anonymous"; 
          img.onload = () => {
             const canvas = canvasRef.current;
             if (!canvas) return;
             if (!tempCanvasRef.current) tempCanvasRef.current = document.createElement('canvas');
             const tempCanvas = tempCanvasRef.current;
             
             const frameW = Math.floor(img.naturalWidth / COLS);
             const frameH = Math.floor(img.naturalHeight / ROWS);
             
             if (canvas.width !== frameW || canvas.height !== frameH) {
                 canvas.width = frameW;
                 canvas.height = frameH;
                 tempCanvas.width = frameW;
                 tempCanvas.height = frameH;
             }

             const ctx = canvas.getContext('2d', { willReadFrequently: true });
             const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
             if (!ctx || !tempCtx) return;

             const col = localFrameIndex % COLS;
             const row = Math.floor(localFrameIndex / COLS);
             
             tempCtx.clearRect(0, 0, frameW, frameH);
             tempCtx.drawImage(
                 img, 
                 col * frameW, row * frameH, frameW, frameH, 
                 0, 0, frameW, frameH 
             );

             const effectiveRemoveBg = removeBackground || keepCentered; 
             const { offsetX, offsetY } = processFrameData(tempCtx, frameW, frameH, effectiveRemoveBg, keepCentered, tolerance);

             // Apply Manual Offsets
             const manualOffset = data.frameOffsets?.[frameIndex] || { x: 0, y: 0 };
             const finalX = offsetX + manualOffset.x;
             const finalY = offsetY + manualOffset.y;

             ctx.clearRect(0, 0, frameW, frameH);
             
             // Visual Guide for Edit Mode (Behind image)
             if (isEditingMode) {
                 ctx.strokeStyle = '#ef4444';
                 ctx.lineWidth = 1;
                 ctx.setLineDash([5, 5]);
                 ctx.beginPath();
                 ctx.moveTo(frameW/2, 0);
                 ctx.lineTo(frameW/2, frameH);
                 ctx.moveTo(0, frameH/2);
                 ctx.lineTo(frameW, frameH/2);
                 ctx.stroke();
                 ctx.setLineDash([]);
             }

             ctx.drawImage(tempCanvas, finalX, finalY);
             
             // Visual Guide for Edit Mode (Foreground)
             if (isEditingMode) {
                 ctx.strokeStyle = '#eab308';
                 ctx.lineWidth = 2;
                 ctx.strokeRect(0, 0, frameW, frameH);
             }
          };
          img.src = currentSheetSrc;
      }
  }, [videoType, spriteSheets, frameIndex, removeBackground, keepCentered, framesPerSheet, ROWS, data.frameOffsets, isEditingMode, tolerance]);

  useEffect(() => {
      const FPS = 8;
      if (videoType === 'sequence' && spriteSheets.length > 0 && isPlaying) {
          const interval = setInterval(() => {
              setFrameIndex(prev => (prev + 1) % totalFrames);
          }, 1000 / FPS);
          return () => clearInterval(interval);
      }
  }, [videoType, spriteSheets, isPlaying, totalFrames]);


  const handleRun = () => data.onRun?.();

  const downloadVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoType === 'veo' && data.video) {
        const link = document.createElement('a');
        link.href = data.video;
        link.download = `veo-video-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else if (videoType === 'sequence' && spriteSheets.length > 0 && canvasRef.current) {
        const canvas = canvasRef.current;
        const stream = canvas.captureStream(30); 
        const mimeType = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `sequence-anim-${Date.now()}.${mimeType === "video/mp4" ? "mp4" : "webm"}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        recorder.start();
        const FPS = 8;
        const loopDuration = (totalFrames / FPS) * 1000;
        setTimeout(() => { recorder.stop(); }, loopDuration + 100); 
    }
  };

  const downloadGif = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (spriteSheets.length === 0) return;
    setIsProcessingGif(true);
    try {
        const gif = GIFEncoder();
        let frameW = 0;
        let frameH = 0;
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        const bufferCanvas = document.createElement('canvas');
        const bCtx = bufferCanvas.getContext('2d', { willReadFrequently: true });

        for (let s = 0; s < spriteSheets.length; s++) {
            const img = new Image();
            img.src = spriteSheets[s];
            img.crossOrigin = "anonymous";
            await img.decode();
            if (s === 0) {
                frameW = Math.floor(img.naturalWidth / COLS);
                frameH = Math.floor(img.naturalHeight / ROWS);
                tempCanvas.width = frameW;
                tempCanvas.height = frameH;
                bufferCanvas.width = frameW;
                bufferCanvas.height = frameH;
            }
            if (!ctx || !bCtx) continue;
            for (let i = 0; i < framesPerSheet; i++) {
                const col = i % COLS;
                const row = Math.floor(i / COLS);
                
                // 1. Draw original frame to temp
                ctx.clearRect(0, 0, frameW, frameH);
                ctx.drawImage(img, col * frameW, row * frameH, frameW, frameH, 0, 0, frameW, frameH);
                
                // 2. Process (Center/RemoveBG)
                const { offsetX, offsetY } = processFrameData(ctx, frameW, frameH, removeBackground || keepCentered, keepCentered, tolerance);
                
                // 3. Apply Manual Offset
                const manualOffset = data.frameOffsets?.[(s * framesPerSheet) + i] || { x: 0, y: 0 };
                const finalX = offsetX + manualOffset.x;
                const finalY = offsetY + manualOffset.y;
                
                // 4. Composite final frame
                bCtx.clearRect(0, 0, frameW, frameH);
                bCtx.drawImage(tempCanvas, 0, 0); // Copy processed pixels from ctx
                
                ctx.clearRect(0, 0, frameW, frameH); // Clear main ctx
                ctx.drawImage(bufferCanvas, finalX, finalY); // Draw processed pixels at new location
                
                const imageData = ctx.getImageData(0, 0, frameW, frameH);
                const dataPixels = imageData.data;
                const palette = quantize(dataPixels, 256);
                const index = applyPalette(dataPixels, palette);
                gif.writeFrame(index, frameW, frameH, { palette, delay: 125, transparent: true }); 
            }
        }
        gif.finish();
        const buffer = gif.bytes();
        const blob = new Blob([buffer], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sequence-${Date.now()}.gif`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("GIF Generation failed", error);
    } finally {
        setIsProcessingGif(false);
    }
  };

  const downloadSpriteSheet = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (spriteSheets.length === 0) return;
      spriteSheets.forEach((sheet, idx) => {
          const link = document.createElement('a');
          link.href = sheet;
          link.download = `spritesheet-${idx+1}-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      });
  }

  const clearUploadedImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.setUploadedImage?.(undefined);
  };

  return (
    <NodeWrapper 
      title={videoType === 'veo' ? "视频生成 (Veo)" : "序列帧动画 (Sequence)"}
      selected={selected} 
      inputs={[
        { id: 'prompt', label: '提示词' },
        { id: 'image', label: '参考图' }
      ]}
      outputs={[{ id: 'video', label: videoType === 'veo' ? '视频' : '动画' }]}
      colorClass={videoType === 'veo' ? "border-pink-500" : "border-purple-500"}
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-3 h-full min-w-[280px]">
        
        <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
            <button onClick={() => setVideoType('sequence')} className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-medium rounded transition-colors ${videoType === 'sequence' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}>
                <Images size={12} /> Frame Seq
            </button>
             <button onClick={() => setVideoType('veo')} className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-medium rounded transition-colors ${videoType === 'veo' ? 'bg-pink-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}>
                <Video size={12} /> Veo Video
            </button>
        </div>

        <div 
            className={`relative flex-1 min-h-0 w-full bg-black/40 rounded-md overflow-hidden border flex items-center justify-center group aspect-video transition-colors ${isDragging ? (videoType === 'veo' ? 'border-pink-400 bg-pink-900/20' : 'border-purple-400 bg-purple-900/20') : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
           {isDragging && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                 <span className={`${videoType === 'veo' ? 'text-pink-400' : 'text-purple-400'} font-bold text-sm`}>释放上传参考图</span>
             </div>
           )}

           {videoType === 'veo' && (
               data.video ? (
                 <>
                    <video src={data.video} controls className="w-full h-full object-contain" autoPlay loop />
                    <button onClick={downloadVideo} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10" title="下载视频">
                        <Download size={14} />
                    </button>
                 </>
               ) : (
                 <div className="text-center p-4">
                    <Film className="mx-auto mb-2 text-gray-600" size={32} />
                    <span className="text-xs text-gray-500 block">等待 Veo 生成...</span>
                    {!inputImage && (
                        <label className="mt-2 inline-flex flex-col items-center cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                            <Upload size={14} className="text-gray-500 mb-1" />
                            <span className="text-[10px] text-gray-500">上传参考图</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>
                    )}
                 </div>
               )
           )}

           {videoType === 'sequence' && (
               spriteSheets.length > 0 ? (
                   <>
                        <div 
                            className={`w-full h-full flex items-center justify-center ${(removeBackground || keepCentered) ? 'bg-[url(https://checkerboard-pattern.vercel.app/image.png)] bg-repeat bg-[length:20px_20px]' : ''} ${isEditingMode ? 'cursor-move nodrag' : ''}`}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={handleCanvasMouseUp}
                        >
                            <canvas ref={canvasRef} className="w-full h-full object-contain image-pixelated pointer-events-none" />
                        </div>
                        
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-1 rounded-full backdrop-blur-sm opacity-100 transition-opacity z-10">
                            {isEditingMode ? (
                                <>
                                    <button onClick={handlePrevFrame} className="p-1 hover:text-purple-400 text-white"><ChevronLeft size={12} /></button>
                                    <span className="text-[10px] text-white font-mono flex items-center w-8 justify-center">{frameIndex + 1}/{totalFrames}</span>
                                    <button onClick={handleNextFrame} className="p-1 hover:text-purple-400 text-white"><ChevronRight size={12} /></button>
                                </>
                            ) : (
                                <button onClick={() => setIsPlaying(!isPlaying)} className="p-1 hover:text-purple-400 text-white">
                                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                                </button>
                            )}
                        </div>

                        {!isEditingMode && (
                             <div className="absolute bottom-2 right-2 bg-black/50 px-2 py-0.5 rounded text-[9px] text-white/80 font-mono pointer-events-none">
                                {frameIndex + 1}/{totalFrames}
                            </div>
                        )}

                        <div className="absolute bottom-2 left-2 flex gap-1">
                            <button onClick={() => setRemoveBackground(!removeBackground)} className={`p-1.5 rounded-full transition-colors z-20 ${removeBackground ? 'bg-purple-600 text-white' : 'bg-black/60 text-gray-300 hover:text-white'}`} title="移除背景"><Eraser size={12} /></button>
                            <button onClick={() => setKeepCentered(!keepCentered)} className={`p-1.5 rounded-full transition-colors z-20 ${keepCentered ? 'bg-purple-600 text-white' : 'bg-black/60 text-gray-300 hover:text-white'}`} title="自动居中"><Focus size={12} /></button>
                            
                            {/* Toggle Edit Mode */}
                            <button 
                                onClick={toggleEditMode} 
                                className={`p-1.5 rounded-full transition-colors z-20 ${isEditingMode ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50' : 'bg-black/60 text-gray-300 hover:text-white'}`} 
                                title={isEditingMode ? "完成编辑" : "手动调整帧位置"}
                            >
                                {isEditingMode ? <Grid size={12} /> : <Move size={12} />}
                            </button>
                        </div>
                        
                        {isEditingMode && (
                             <div className="absolute top-2 left-2 z-20">
                                <button onClick={handleResetFrame} className="p-1.5 bg-red-600/80 hover:bg-red-500 rounded-full text-white shadow-lg" title="重置当前帧位置">
                                    <RotateCcw size={12} />
                                </button>
                             </div>
                        )}

                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={downloadSpriteSheet} className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white"><Images size={14} /></button>
                            <button onClick={downloadGif} disabled={isProcessingGif} className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white disabled:opacity-50">{isProcessingGif ? <Loader2 size={14} className="animate-spin"/> : <FileVideo size={14} />}</button>
                             <button onClick={downloadVideo} className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white"><Download size={14} /></button>
                        </div>
                   </>
               ) : (
                   <div className="text-center p-4">
                        <Clapperboard className="mx-auto mb-2 text-gray-600" size={32} />
                        <span className="text-xs text-gray-500 block">等待序列生成...</span>
                        {!inputImage && (
                             <label className="mt-2 inline-flex flex-col items-center cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                                <Upload size={14} className="text-gray-500 mb-1" />
                                <span className="text-[10px] text-gray-500">上传参考图</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                            </label>
                        )}
                   </div>
               )
           )}
           
           {inputImage && !edges.some(e => e.target === id && e.targetHandle === 'image') && !data.video && spriteSheets.length === 0 && (
                <div className="absolute bottom-2 left-2 bg-purple-900/50 text-purple-200 text-[9px] px-1.5 py-0.5 rounded border border-purple-500/30 flex items-center gap-1 z-10">
                    已上传图片
                    <button onClick={clearUploadedImage} className="hover:text-white"><X size={8} /></button>
                </div>
           )}

           {data.isLoading && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-20">
               <div className="flex flex-col items-center px-4 text-center">
                 <Loader2 className={`animate-spin mb-2 ${videoType === 'veo' ? 'text-pink-400' : 'text-purple-400'}`} size={32} />
                 <span className={`text-xs font-medium ${videoType === 'veo' ? 'text-pink-400' : 'text-purple-400'}`}>
                     {videoType === 'veo' ? 'Veo 正在生成...' : `绘制序列 (${data.frameCount || 12} 帧)...`}
                 </span>
               </div>
             </div>
           )}
        </div>

        {/* Tolerance Controls */}
        {videoType === 'sequence' && spriteSheets.length > 0 && removeBackground && (
            <div className="flex items-center gap-2 px-1 bg-white/5 rounded border border-white/5 p-1">
                <SlidersHorizontal size={10} className="text-gray-400" />
                <span className="text-[10px] text-gray-400">容差</span>
                <input 
                    type="range" 
                    min="10" 
                    max="200" 
                    value={tolerance} 
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    onPointerDown={(e) => e.stopPropagation()} 
                />
                <span className="text-[10px] text-gray-400 w-6 text-right">{tolerance}</span>
            </div>
        )}

        <div className="flex items-center justify-between gap-2 px-1">
            {videoType === 'veo' ? (
                <>
                    <div className="flex items-center gap-1 text-gray-400">
                        <Ratio size={12} />
                        <span className="text-[10px]">比例</span>
                    </div>
                    <select className="bg-black/40 border border-white/20 rounded text-[10px] text-gray-200 px-2 py-1 outline-none cursor-pointer w-[100px] focus:border-pink-500" value={data.aspectRatio || "16:9"} onChange={(e) => data.setAspectRatio?.(e.target.value)} onPointerDown={(e) => e.stopPropagation()} disabled={data.disabled}>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                    </select>
                </>
            ) : (
                <>
                    <div className="flex items-center gap-1 text-gray-400">
                        <Layers size={12} />
                        <span className="text-[10px]">帧数</span>
                    </div>
                     <select className="bg-black/40 border border-white/20 rounded text-[10px] text-gray-200 px-2 py-1 outline-none cursor-pointer w-[100px] focus:border-purple-500" value={data.frameCount || 12} onChange={(e) => data.setFrameCount?.(Number(e.target.value))} onPointerDown={(e) => e.stopPropagation()} disabled={data.disabled}>
                        <option value="12">12 (标准)</option>
                        <option value="24">24 (流畅)</option>
                        <option value="36">36 (丝滑)</option>
                    </select>
                </>
            )}
        </div>

        {data.error && (
            <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-900/50 break-words shrink-0">
                {data.error}
            </div>
        )}

        <button 
          className="nodrag flex items-center justify-center gap-2 w-full py-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          onClick={handleRun}
          disabled={data.isLoading}
        >
          {videoType === 'veo' ? <Video size={14} /> : <Clapperboard size={14} />}
          {data.isLoading ? '生成中...' : (videoType === 'veo' ? '生成视频' : '生成序列')}
        </button>
      </div>
    </NodeWrapper>
  );
};