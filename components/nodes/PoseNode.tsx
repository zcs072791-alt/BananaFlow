import React, { useMemo, useState, useRef } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode, PoseLandmark } from '../../types';
import { Loader2, Download, ScanLine, Play, RotateCcw, X, Move, FileText, ChevronRight, Bone, Type, Upload } from 'lucide-react';

// Joint definitions for drawing skeleton lines
const CONNECTIONS = [
    ['nose', 'neck'],
    ['neck', 'right_shoulder'],
    ['neck', 'left_shoulder'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['neck', 'right_hip'], // Approximate spine
    ['neck', 'left_hip'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_shoulder', 'right_hip'], // Torso box
    ['left_shoulder', 'left_hip'],
    ['right_hip', 'left_hip']
];

// Define which connections represent the "Core" (Torso/Body)
// Dragging these will move the ENTIRE skeleton.
const CORE_CONNECTIONS = new Set([
    'neck-right_shoulder', 'neck-left_shoulder',
    'neck-right_hip', 'neck-left_hip',
    'right_shoulder-right_hip', 'left_shoulder-left_hip',
    'right_hip-left_hip'
]);

// Color Logic for SVG Display (3D Volumetric Style)
// We return base colors, and the rendering logic creates the "Cylinder" effect using layered strokes
const getBoneColors = (start: string, end: string) => {
    // Torso (Blue)
    if (start.includes('hip') && end.includes('hip') || 
        (start.includes('shoulder') && end.includes('hip')) ||
        (start === 'neck')
       ) {
        return { dark: '#0f286e', mid: '#2563EB', light: '#60a5fa', width: 24 }; // Blue
    }
    
    // Right Arm (Red)
    if (start.includes('right') && (start.includes('shoulder') || start.includes('elbow'))) {
         return { dark: '#7f1d1d', mid: '#DC2626', light: '#f87171', width: 18 }; // Red
    }

    // Left Arm (Pink)
    if (start.includes('left') && (start.includes('shoulder') || start.includes('elbow'))) {
         return { dark: '#831843', mid: '#DB2777', light: '#f472b6', width: 18 }; // Pink
    }

    // Right Leg (Green)
    if (start.includes('right') && (start.includes('hip') || start.includes('knee'))) {
         return { dark: '#14532d', mid: '#16A34A', light: '#4ade80', width: 22 }; // Green
    }

     // Left Leg (Teal)
    if (start.includes('left') && (start.includes('hip') || start.includes('knee'))) {
         return { dark: '#134e4a', mid: '#0D9488', light: '#2dd4bf', width: 22 }; // Teal
    }
    
    // Head/Neck
    return { dark: '#854d0e', mid: '#FACC15', light: '#fef08a', width: 14 }; // Yellow
};

const getJointColor = (id: string) => {
    if (id.includes('right')) return '#DC2626'; // Red
    if (id.includes('left')) return '#0D9488'; // Teal
    return '#FACC15'; // Yellow
};

export const PoseNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dragging State
  const [draggingJointId, setDraggingJointId] = useState<string | null>(null);
  
  // Skeleton Dragging State
  const [draggingBone, setDraggingBone] = useState<{ start: string, end: string, isCore: boolean } | null>(null);
  const [hoveredBone, setHoveredBone] = useState<string | null>(null);
  const lastMousePos = useRef<{x: number, y: number} | null>(null);

  // Image Dimensions for accurate overlay
  const [imgDimensions, setImgDimensions] = useState<{width: number, height: number} | null>(null);

  // Mode Selection (Default to Skeleton)
  const mode = data.poseControlMode || 'skeleton';
  const setMode = (m: 'skeleton' | 'text') => {
      if (data.setPoseControlMode) data.setPoseControlMode(m);
  };

  // Restore Local Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            data.setUploadedImage?.(reader.result);
            if (data.setPoseLandmarks) data.setPoseLandmarks([]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Ref Image Handler
  const handleRefFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string' && data.onRun) {
             data.onRun({ type: 'analyze_ref', image: reader.result });
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
                if (data.setPoseLandmarks) data.setPoseLandmarks([]);
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
          return sourceNode?.data.image || sourceNode?.data.uploadedImage;
      }
      return undefined;
  }, [edges, nodes, id, data.uploadedImage]);

  const displayImage = data.image || inputImage;
  const landmarks = data.poseLandmarks || [];
  const hasLandmarks = landmarks.length > 0;
  const hasResult = !!data.image;

  // Image Load Handler
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      setImgDimensions({
          width: e.currentTarget.naturalWidth,
          height: e.currentTarget.naturalHeight
      });
  };

  // --- Joint Dragging Logic ---

  const handleJointPointerDown = (e: React.PointerEvent, jointId: string) => {
      e.stopPropagation();
      e.preventDefault(); 
      
      const element = e.currentTarget as HTMLDivElement;
      element.setPointerCapture(e.pointerId);
      setDraggingJointId(jointId);
  };

  const handleJointPointerMove = (e: React.PointerEvent, jointId: string) => {
      e.stopPropagation();
      e.preventDefault();
      
      if (draggingJointId !== jointId || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;

      const safeX = Math.max(0, Math.min(100, xPct));
      const safeY = Math.max(0, Math.min(100, yPct));

      const updatedLandmarks = (data.poseLandmarks || []).map(lm => 
          lm.id === jointId ? { ...lm, x: safeX, y: safeY } : lm
      );
      
      if (data.setPoseLandmarks) data.setPoseLandmarks(updatedLandmarks);
  };

  const handleJointPointerUp = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      const element = e.currentTarget as HTMLDivElement;
      element.releasePointerCapture(e.pointerId);
      setDraggingJointId(null);
  };

  // --- Bone Dragging Logic ---

  const isCoreBone = (start: string, end: string) => {
      return CORE_CONNECTIONS.has(`${start}-${end}`) || CORE_CONNECTIONS.has(`${end}-${start}`);
  };

  const handleBonePointerDown = (e: React.PointerEvent, start: string, end: string) => {
      e.stopPropagation();
      e.preventDefault();
      const element = e.currentTarget as Element;
      element.setPointerCapture(e.pointerId);
      
      setDraggingBone({ 
          start, 
          end, 
          isCore: isCoreBone(start, end) 
      });
      lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleBonePointerMove = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      if (!draggingBone || !lastMousePos.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const dxPx = e.clientX - lastMousePos.current.x;
      const dyPx = e.clientY - lastMousePos.current.y;
      
      const dxPct = (dxPx / rect.width) * 100;
      const dyPct = (dyPx / rect.height) * 100;

      let updatedLandmarks: PoseLandmark[];

      if (draggingBone.isCore) {
          // Move WHOLE skeleton
          updatedLandmarks = (data.poseLandmarks || []).map(lm => ({
              ...lm,
              x: Math.max(0, Math.min(100, lm.x + dxPct)),
              y: Math.max(0, Math.min(100, lm.y + dyPct))
          }));
      } else {
          // Move ONLY the connected joints (Limb segment)
          updatedLandmarks = (data.poseLandmarks || []).map(lm => {
              if (lm.id === draggingBone.start || lm.id === draggingBone.end) {
                  return {
                      ...lm,
                      x: Math.max(0, Math.min(100, lm.x + dxPct)),
                      y: Math.max(0, Math.min(100, lm.y + dyPct))
                  };
              }
              return lm;
          });
      }
      
      if (data.setPoseLandmarks) data.setPoseLandmarks(updatedLandmarks);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleBonePointerUp = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const element = e.currentTarget as Element;
      element.releasePointerCapture(e.pointerId);
      setDraggingBone(null);
      lastMousePos.current = null;
  };

  const handleBoneEnter = (start: string, end: string) => {
      setHoveredBone(`${start}-${end}`);
  }

  const handleBoneLeave = () => {
      setHoveredBone(null);
  }

  // --- General Actions ---

  const handleDetect = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.onRun) data.onRun({ type: 'detect' });
  };

  const handleGenerate = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.onRun) data.onRun({ type: 'generate' });
  };

  const downloadImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!displayImage) return;
      const link = document.createElement('a');
      link.href = displayImage;
      link.download = `pose-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleClearResult = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.onSelectImage?.(''); 
  };
  
  const clearUploadedImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      data.setUploadedImage?.(undefined);
      setImgDimensions(null);
      if (data.setPoseLandmarks) data.setPoseLandmarks([]);
      if (data.setPoseDescription) data.setPoseDescription('');
  };

  const clearPoseReferenceImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.setPoseReferenceImage) data.setPoseReferenceImage(undefined);
  };

  const getCoords = (id: string) => landmarks.find(lm => lm.id === id);

  return (
    <NodeWrapper 
      title="姿态编辑 (Pose)" 
      selected={selected} 
      inputs={[
          { id: 'image', label: '原图' },
          { id: 'prompt', label: '动作提示词' }
      ]}
      outputs={[{ id: 'image', label: '新图' }]}
      colorClass="border-lime-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex gap-3 h-[500px] w-[700px]">
        
        {/* LEFT: Image / Skeleton Interaction */}
        <div 
            className={`nodrag nopan relative flex-1 w-2/3 h-full bg-black/40 rounded-md overflow-hidden border flex items-center justify-center group transition-colors ${isDragging ? 'border-lime-400 bg-lime-900/20' : 'border-white/5'} ${hasLandmarks && !hasResult && mode === 'skeleton' ? 'cursor-default' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onMouseDown={(e) => e.stopPropagation()}
        >
           {isDragging && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                 <span className="text-lime-400 font-bold text-sm">释放上传图片</span>
             </div>
           )}

           {displayImage ? (
             <div 
                className="relative bg-black"
                style={{
                    aspectRatio: imgDimensions ? `${imgDimensions.width}/${imgDimensions.height}` : 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%'
                }}
             >
                <img 
                    src={displayImage} 
                    alt="Pose Target" 
                    className={`w-full h-full object-contain select-none pointer-events-none block ${hasLandmarks && !hasResult && mode === 'skeleton' ? 'opacity-50' : ''}`} 
                    decoding="async" 
                    onLoad={handleImageLoad}
                />
                
                {imgDimensions && mode === 'skeleton' && (
                    <div ref={containerRef} className="absolute inset-0 w-full h-full">
                        {hasLandmarks && !hasResult && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                                {CONNECTIONS.map(([start, end], idx) => {
                                    const p1 = getCoords(start);
                                    const p2 = getCoords(end);
                                    if (p1 && p2) {
                                        const isCore = isCoreBone(start, end);
                                        const boneId = `${start}-${end}`;
                                        const colors = getBoneColors(start, end);
                                        const isHovered = hoveredBone === boneId;
                                        const isDraggingThis = draggingBone && draggingBone.start === start && draggingBone.end === end;
                                        
                                        // 3D Cylinder Simulation using Layered Strokes
                                        // Layer 1: Dark Edge (Widest)
                                        // Layer 2: Mid Body (Medium)
                                        // Layer 3: Highlight (Narrow, Center)
                                        
                                        return (
                                            <g key={idx} 
                                                className={`pointer-events-auto ${isCore ? 'cursor-move' : 'cursor-grab active:cursor-grabbing'}`}
                                                onPointerDown={(e) => handleBonePointerDown(e, start, end)}
                                                onPointerMove={handleBonePointerMove}
                                                onPointerUp={handleBonePointerUp}
                                                onPointerEnter={() => handleBoneEnter(start, end)}
                                                onPointerLeave={handleBoneLeave}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                {/* Invisible thick line for easier grabbing */}
                                                <line 
                                                    x1={`${p1.x}%`} y1={`${p1.y}%`}
                                                    x2={`${p2.x}%`} y2={`${p2.y}%`}
                                                    stroke="transparent"
                                                    strokeWidth={Math.max(40, colors.width * 2)}
                                                    strokeLinecap="round"
                                                />
                                                
                                                {/* Layer 1: Dark Edge */}
                                                <line 
                                                    x1={`${p1.x}%`} y1={`${p1.y}%`}
                                                    x2={`${p2.x}%`} y2={`${p2.y}%`}
                                                    stroke={isHovered ? '#FFFFFF' : colors.dark}
                                                    strokeWidth={colors.width + (isHovered ? 2 : 0)}
                                                    strokeLinecap="round"
                                                    style={{ transition: 'stroke 0.1s' }}
                                                />
                                                
                                                {/* Layer 2: Mid Color (Body) */}
                                                {!isHovered && (
                                                    <line 
                                                        x1={`${p1.x}%`} y1={`${p1.y}%`}
                                                        x2={`${p2.x}%`} y2={`${p2.y}%`}
                                                        stroke={colors.mid}
                                                        strokeWidth={colors.width * 0.7}
                                                        strokeLinecap="round"
                                                    />
                                                )}

                                                {/* Layer 3: Highlight (Specular) */}
                                                {!isHovered && (
                                                    <line 
                                                        x1={`${p1.x}%`} y1={`${p1.y}%`}
                                                        x2={`${p2.x}%`} y2={`${p2.y}%`}
                                                        stroke={colors.light}
                                                        strokeWidth={colors.width * 0.25}
                                                        strokeLinecap="round"
                                                        strokeOpacity={0.6}
                                                    />
                                                )}
                                            </g>
                                        );
                                    }
                                    return null;
                                })}
                            </svg>
                        )}
                        
                        {hasLandmarks && !hasResult && landmarks.map((lm) => (
                            <div
                                key={lm.id}
                                onPointerDown={(e) => handleJointPointerDown(e, lm.id)}
                                onPointerMove={(e) => handleJointPointerMove(e, lm.id)}
                                onPointerUp={handleJointPointerUp}
                                onMouseDown={(e) => e.stopPropagation()} 
                                className={`nodrag nopan absolute w-4 h-4 rounded-full shadow-lg cursor-move z-20 transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform ${draggingJointId === lm.id ? 'scale-125 ring-2 ring-white' : ''}`}
                                style={{ 
                                    left: `${lm.x}%`, 
                                    top: `${lm.y}%`,
                                    background: `radial-gradient(circle at 35% 35%, white, ${getJointColor(lm.id)}, #000)`, // Fake 3D Sphere
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                    touchAction: 'none',
                                    width: '14px',
                                    height: '14px'
                                }}
                                title={lm.id}
                            />
                        ))}
                    </div>
                )}

                <div className="absolute top-2 right-2 flex gap-1 z-30">
                     {!hasResult && (
                        <button 
                            onClick={handleDetect}
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                            title="重新识别 (Re-identify)"
                        >
                            <ScanLine size={12} />
                        </button>
                    )}

                    {hasResult && (
                         <button 
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                            onClick={handleClearResult}
                            title="继续编辑骨骼"
                        >
                            <RotateCcw size={12} />
                        </button>
                    )}
                    <button 
                        onClick={downloadImage}
                        className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                    >
                        <Download size={12} />
                    </button>
                     {!hasResult && data.uploadedImage && (
                        <button 
                             className="p-1.5 bg-red-500/80 hover:bg-red-600/80 rounded-full text-white transition-colors nodrag"
                             onClick={clearUploadedImage}
                             title="移除图片"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
             </div>
           ) : (
             <label className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full h-full hover:bg-white/5 transition-colors p-4">
                <Move className="text-gray-600" size={32} />
                <span className="text-xs text-gray-500 text-center">拖入人物图片</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
             </label>
           )}

           {data.isLoading && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-30">
               <div className="flex flex-col items-center">
                 <Loader2 className="animate-spin text-lime-400 mb-2" size={32} />
                 <span className="text-xs text-lime-400 font-medium">
                     {data.isAnalyzing ? '识别动作中...' : '生成中...'}
                 </span>
               </div>
             </div>
           )}
        </div>

        {/* RIGHT: Description & Controls */}
        <div className="flex flex-col w-1/3 h-full bg-neutral-900/50 rounded-md border border-white/5 overflow-hidden">
             <div className="p-2 bg-white/5 border-b border-white/5 flex items-center shrink-0">
                 <div className="flex items-center gap-2 text-gray-300 text-xs font-bold uppercase tracking-wider">
                     <FileText size={14} className="text-lime-400" />
                     动作描述 (Description)
                 </div>
             </div>

             <div className="flex-1 p-2 flex flex-col gap-2 min-h-0">
                 
                 {/* Reference Action Image Upload Area */}
                 <div className="relative w-full h-24 bg-black/20 rounded border border-white/10 shrink-0 overflow-hidden group">
                     {data.poseReferenceImage ? (
                         <>
                             <img src={data.poseReferenceImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Reference Action" />
                             <button 
                                 onClick={clearPoseReferenceImage}
                                 className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                 title="移除参考图"
                             >
                                 <X size={10} />
                             </button>
                             <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-gray-300 px-1 py-0.5 text-center">
                                 参考动作 (Ref Action)
                             </div>
                         </>
                     ) : (
                         <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-white/5 transition-colors">
                             <Upload size={14} className="text-gray-500 mb-1" />
                             <span className="text-[9px] text-gray-500">上传参考动作图</span>
                             <span className="text-[8px] text-gray-600 mt-0.5">自动提取动作描述</span>
                             <input type="file" accept="image/*" className="hidden" onChange={handleRefFileUpload} />
                         </label>
                     )}
                 </div>

                 <div className="text-[10px] text-gray-500 leading-tight">
                     AI 自动识别动作描述，您可以修改下方文本来调整生成结果。
                 </div>
                 <textarea
                     className="nodrag w-full flex-1 bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-200 focus:text-white focus:border-lime-500 outline-none resize-none custom-scrollbar leading-relaxed"
                     placeholder="动作描述将显示在这里..."
                     value={data.poseDescription || ''}
                     onChange={(e) => data.setPoseDescription?.(e.target.value)}
                     onKeyDown={(e) => e.stopPropagation()}
                     disabled={data.isLoading}
                 />
                 
                 {hasLandmarks && !hasResult && mode === 'skeleton' && (
                    <div className="text-[10px] text-gray-500 text-center bg-white/5 p-1 rounded shrink-0 flex items-center justify-center gap-2">
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> 右肢</span>
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-teal-600"></div> 左肢</span>
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-600"></div> 躯干</span>
                    </div>
                )}
             </div>

             <div className="p-2 border-t border-white/10 bg-white/5 shrink-0 flex flex-col gap-2">
                 
                 {/* Mode Toggle */}
                 <div className="flex bg-black/30 p-1 rounded border border-white/5 gap-1">
                     <button
                        onClick={() => setMode('skeleton')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-all ${mode === 'skeleton' ? 'bg-lime-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                     >
                         <Bone size={12} /> 骨骼控制
                     </button>
                     <button
                        onClick={() => setMode('text')}
                         className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-all ${mode === 'text' ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                     >
                         <Type size={12} /> 文本生成
                     </button>
                 </div>

                 {!hasLandmarks && mode === 'skeleton' ? (
                    <button 
                        className="nodrag w-full py-2 bg-lime-700 hover:bg-lime-600 active:bg-lime-800 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        onClick={handleDetect}
                        disabled={data.isLoading || !inputImage || hasResult}
                    >
                        <ScanLine size={14} />
                        识别骨骼 (Identify)
                    </button>
                ) : (
                    <button 
                        className="nodrag w-full py-2 bg-lime-600 hover:bg-lime-500 active:bg-lime-700 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        onClick={handleGenerate}
                        disabled={data.isLoading}
                    >
                        <Play size={14} fill="currentColor" />
                        生成动作 (Generate)
                    </button>
                )}
             </div>
        </div>

        {data.error && (
            <div className="absolute bottom-4 left-4 right-4 text-red-400 text-xs p-2 bg-red-900/90 rounded border border-red-900/50 break-words pointer-events-none">
                {data.error}
            </div>
        )}

      </div>
    </NodeWrapper>
  );
};