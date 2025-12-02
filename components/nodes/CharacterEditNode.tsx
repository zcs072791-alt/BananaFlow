import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode, CustomEditPoint, CharacterAttributes } from '../../types';
import { ScanFace, Loader2, Download, UserCog, RefreshCw, Wand2, X, RotateCcw, MousePointerClick, Trash2, ImagePlus, Box, Check, RotateCw } from 'lucide-react';
import { identifyElementAtPoint } from '../../services/geminiService';

// Ordered list of attributes with Chinese labels
const ATTRIBUTE_LABELS: Record<string, string> = {
  style: '风格 (Style)',
  head: '头部 (Head)',
  eyes: '眼睛 (Eyes)',
  nose: '鼻子 (Nose)',
  mouth: '嘴巴 (Mouth)',
  expression: '表情 (Expression)',
  clothing: '服装 (Clothing)',
  upper_body: '上身 (Upper Body)',
  lower_body: '下身 (Lower Body)',
  shoes: '鞋子 (Shoes)',
  held_item: '手持物 (Held Item)'
};

// Helper to normalize angle to -180 to 180 range
const normalizeAngle = (angle: number) => {
    let a = angle % 360;
    if (a > 180) a -= 360;
    if (a < -180) a += 360;
    return a;
};

export const CharacterEditNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();
  const [isDragging, setIsDragging] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  const [dragOverPointId, setDragOverPointId] = useState<string | null>(null);

  // Rotation State: x (Pitch), y (Yaw)
  const [rotation, setRotation] = useState({ x: -20, y: -20 });
  const [showRotationControl, setShowRotationControl] = useState(false);
  const [isDraggingCube, setIsDraggingCube] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

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
          return sourceNode?.data.image || sourceNode?.data.uploadedImage;
      }
      return undefined;
  }, [edges, nodes, id, data.uploadedImage]);

  const displayImage = data.image || inputImage;
  const hasResult = !!data.image;

  const handleAttributeChange = (key: string, value: string) => {
      const currentAttrs = data.characterAttributes || {};
      if (data.setCharacterAttributes) {
          data.setCharacterAttributes({ ...currentAttrs, [key]: value });
      }
  };

  const handleGenerate = () => {
      if (data.onRun) data.onRun({ type: 'generate' });
  };
  
  // Handle manual analysis triggering
  const handleAnalyze = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.onRun) {
          data.onRun({ type: 'analyze' });
      }
  };
  
  // Auto-populate custom edits from analysis results if they exist and user hasn't edited yet
  useEffect(() => {
      const attrs = data.characterAttributes;
      if (attrs && attrs.feature_points && (!attrs.customEdits || attrs.customEdits.length === 0)) {
          const newEdits: CustomEditPoint[] = attrs.feature_points.map((fp: any, idx: number) => ({
              id: `auto-${idx}-${Date.now()}`,
              x: fp.x,
              y: fp.y,
              prompt: `Edit ${fp.label}`,
              label: fp.label
          }));
          
          if (data.setCharacterAttributes && newEdits.length > 0) {
              data.setCharacterAttributes({
                  ...attrs,
                  customEdits: newEdits
              });
          }
      }
  }, [data.characterAttributes, data.setCharacterAttributes]);

  const downloadImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!displayImage) return;
      const link = document.createElement('a');
      link.href = displayImage;
      link.download = `character-${Date.now()}.png`;
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
      if (data.setCharacterAttributes) data.setCharacterAttributes({});
  };

  // --- Rotation Logic Optimized ---

  const getViewDetails = (rotX: number, rotY: number) => {
      const x = normalizeAngle(rotX);
      const y = normalizeAngle(rotY);

      let vLabel = "平视 (Eye Level)";
      let vPrompt = "Eye level shot, camera parallel to the subject. Standard portrait height.";

      // 5 Vertical Perspectives (Pitch)
      if (x > 60) {
          vLabel = "顶视 (Top-Down)";
          vPrompt = "Extreme high angle, Bird's-eye view, camera looking straight down from above the head. Top of head and shoulders are the primary focus. Body strongly foreshortened downwards. Legs barely visible or very small.";
      } else if (x > 20) {
          vLabel = "俯视 (High Angle)";
          vPrompt = "High angle shot, camera looking down at the character from slightly above eye level. Forehead slightly emphasized. Legs appear slightly shorter due to perspective.";
      } else if (x < -60) {
          vLabel = "底视 (Bottom-Up)";
          vPrompt = "Extreme low angle, Worm's-eye view, camera looking straight up from below the feet. Soles of shoes, chin, and underside of details are visible. Legs appear very long and large. Head appears smaller and distant.";
      } else if (x < -20) {
          vLabel = "仰视 (Low Angle)";
          vPrompt = "Low angle shot, camera positioned low looking up. Emphasizing height, legs and dominance. Chin slightly raised relative to camera.";
      }
      
      // 8 Horizontal Directions (Yaw)
      // Dividing 360 degrees into 8 sectors of 45 degrees each.
      // Front is centered at 0 (-22.5 to 22.5).
      
      let hLabel = "正面 (Front)";
      let hPrompt = "Full Frontal View. Face looking directly at camera. Symmetrical body pose. Both ears visible.";

      if (y >= -22.5 && y < 22.5) {
          hLabel = "正面 (Front)";
          hPrompt = "Full Frontal View. Face looking directly at camera. Symmetrical body pose. Both ears visible.";
      } else if (y >= 22.5 && y < 67.5) {
          hLabel = "右前侧 (Front-Right)";
          hPrompt = "Three-quarter view from the Right. Showing the character's Right side of face and body. Left ear hidden. Nose pointing slightly to the right of frame. Dynamic stance.";
      } else if (y >= 67.5 && y < 112.5) {
          hLabel = "右侧面 (Right Side)";
          hPrompt = "Full Side Profile View from the Right. 90 degrees side view. Nose pointing directly Right. Only one eye and one ear visible. Body sideways, arm covering torso.";
      } else if (y >= 112.5 && y < 157.5) {
          hLabel = "右后侧 (Back-Right)";
          hPrompt = "View from Behind, angled Right. Prominent Right shoulder and back. Face mostly hidden, might see edge of cheek/jaw. Right ear visible from behind. Spine line visible. Posture emphasizes the back.";
      } else if (y >= 157.5 || y < -157.5) {
          hLabel = "背面 (Back)";
          hPrompt = "Full Back View. Dorsal view. Seeing the spine and back of head. No face visible. Shoulders symmetrical. Focus on back design of clothing/hair.";
      } else if (y >= -157.5 && y < -112.5) {
          hLabel = "左后侧 (Back-Left)";
          hPrompt = "View from Behind, angled Left. Prominent Left shoulder and back. Face mostly hidden, might see edge of cheek/jaw. Left ear visible from behind. Spine line visible. Posture emphasizes the back.";
      } else if (y >= -112.5 && y < -67.5) {
          hLabel = "左侧面 (Left Side)";
          hPrompt = "Full Side Profile View from the Left. 90 degrees side view. Nose pointing directly Left. Only one eye and one ear visible. Body sideways, arm covering torso.";
      } else if (y >= -67.5 && y < -22.5) {
          hLabel = "左前侧 (Front-Left)";
          hPrompt = "Three-quarter view from the Left. Showing the character's Left side of face and body. Right ear hidden. Nose pointing slightly to the left of frame. Dynamic stance.";
      }

      const displayLabel = vLabel === "平视 (Eye Level)" ? hLabel : `${vLabel} + ${hLabel.split(' ')[0]}`;
      
      const detailedPrompt = `Camera Angle: ${vPrompt} Orientation: ${hPrompt}`;
      
      return { label: displayLabel, prompt: detailedPrompt };
  };

  const handleCubePointerDown = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      const element = e.currentTarget as HTMLElement;
      element.setPointerCapture(e.pointerId);
      
      setIsDraggingCube(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCubePointerMove = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (isDraggingCube) {
          const deltaX = e.clientX - lastMousePos.current.x;
          const deltaY = e.clientY - lastMousePos.current.y;
          
          setRotation(prev => ({
              x: (prev.x + deltaY) % 360, 
              y: (prev.y + deltaX) % 360  
          }));
          
          lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
  };

  const handleCubePointerUp = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      const element = e.currentTarget as HTMLElement;
      element.releasePointerCapture(e.pointerId);
      
      setIsDraggingCube(false);
  };

  const confirmRotation = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      const viewDetails = getViewDetails(rotation.x, rotation.y);

      // Update attributes with the new detailed View Prompt
      const currentAttrs = data.characterAttributes || {};
      if (data.setCharacterAttributes) {
          data.setCharacterAttributes({ 
              ...currentAttrs, 
              view: viewDetails.prompt 
          });
      }
      
      // Trigger Generation
      if (data.onRun) data.onRun({ type: 'generate' });

      setRotation({ x: -20, y: -20 }); 
      setShowRotationControl(false);
  };

  const cancelRotation = (e: React.MouseEvent) => {
      e.stopPropagation();
      setRotation({ x: -20, y: -20 });
      setShowRotationControl(false);
  }

  // --- Interactive Custom Edits Logic ---

  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  
  const updatePointLabel = (id: string, label: string) => {
      const latestAttrs = dataRef.current.characterAttributes || {};
      const latestEdits = latestAttrs.customEdits || [];
      const updatedEdits = latestEdits.map(p => p.id === id ? { ...p, label, prompt: `修改${label}...` } : p);
      
      if (dataRef.current.setCharacterAttributes) {
          dataRef.current.setCharacterAttributes({ ...latestAttrs, customEdits: updatedEdits });
      }
  };

  const handleImageClick = async (e: React.MouseEvent<HTMLDivElement>) => {
      // Only allow adding points if not dragging and image exists and NOT rotating
      if (hasResult || !inputImage || !imageContainerRef.current || showRotationControl) return;
      
      const rect = imageContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      const newPointId = Date.now().toString();
      const newPoint: CustomEditPoint = {
          id: newPointId,
          x, 
          y,
          prompt: '',
          label: '识别中...'
      };

      const currentAttrs = data.characterAttributes || {};
      const currentEdits = currentAttrs.customEdits || [];
      
      // 1. Add point immediately with "Identifying..." label
      if (data.setCharacterAttributes) {
          data.setCharacterAttributes({
              ...currentAttrs,
              customEdits: [...currentEdits, newPoint]
          });
      }

      // 2. Perform async identification
      try {
          const detectedLabel = await identifyElementAtPoint(inputImage, x, y);
          updatePointLabel(newPointId, detectedLabel);
      } catch (e) {
          updatePointLabel(newPointId, "未知区域");
      }
  };

  const updateCustomEdit = (id: string, prompt: string) => {
      const currentAttrs = data.characterAttributes || {};
      const currentEdits = currentAttrs.customEdits || [];
      const updatedEdits = currentEdits.map(p => p.id === id ? { ...p, prompt } : p);
      
      if (data.setCharacterAttributes) {
          data.setCharacterAttributes({ ...currentAttrs, customEdits: updatedEdits });
      }
  };
  
  // --- Reference Image Logic for Custom Points ---

  const handlePointDragOver = (e: React.DragEvent, pointId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverPointId(pointId);
  };

  const handlePointDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverPointId(null);
  };

  const handlePointDrop = async (e: React.DragEvent, pointId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverPointId(null);
      
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      const imagePromises = Array.from(files)
          .filter((f: File) => f.type.startsWith('image/'))
          .map((file: File) => new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  resolve(reader.result as string);
              };
              reader.readAsDataURL(file);
          }));
      
      const base64Images = await Promise.all(imagePromises);
      
      if (base64Images.length > 0) {
          const currentAttrs = data.characterAttributes || {};
          const currentEdits = currentAttrs.customEdits || [];
          const updatedEdits = currentEdits.map(p => {
              if (p.id === pointId) {
                  const currentRefs = p.referenceImages || [];
                  return { ...p, referenceImages: [...currentRefs, ...base64Images] };
              }
              return p;
          });

          if (data.setCharacterAttributes) {
              data.setCharacterAttributes({ ...currentAttrs, customEdits: updatedEdits });
          }
      }
  };

  const removePointRefImage = (pointId: string, imgIndex: number) => {
      const currentAttrs = data.characterAttributes || {};
      const currentEdits = currentAttrs.customEdits || [];
      const updatedEdits = currentEdits.map(p => {
          if (p.id === pointId && p.referenceImages) {
              const newRefs = [...p.referenceImages];
              newRefs.splice(imgIndex, 1);
              return { ...p, referenceImages: newRefs };
          }
          return p;
      });
      
      if (data.setCharacterAttributes) {
          data.setCharacterAttributes({ ...currentAttrs, customEdits: updatedEdits });
      }
  };

  const removeCustomEdit = (id: string) => {
      const currentAttrs = data.characterAttributes || {};
      const currentEdits = currentAttrs.customEdits || [];
      const updatedEdits = currentEdits.filter(p => p.id !== id);
      
      if (data.setCharacterAttributes) {
          data.setCharacterAttributes({ ...currentAttrs, customEdits: updatedEdits });
      }
  };

  const customEdits = data.characterAttributes?.customEdits || [];
  const currentViewDetails = getViewDetails(rotation.x, rotation.y);

  return (
    <NodeWrapper 
      title="人物编辑 (Character Edit)" 
      selected={selected} 
      inputs={[{ id: 'image', label: '原图' }]}
      outputs={[{ id: 'image', label: '新图' }]}
      colorClass="border-rose-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex gap-3 h-[500px] w-[700px]">
        
        {/* LEFT SIDE: IMAGE PREVIEW */}
        <div className="flex flex-col w-1/2 h-full gap-2">
            <div 
                ref={imageContainerRef}
                className={`relative flex-1 min-h-0 w-full bg-black/40 rounded-md overflow-hidden border flex items-center justify-center group transition-colors ${isDragging ? 'border-rose-400 bg-rose-900/20' : 'border-white/5'} ${!hasResult && inputImage && !showRotationControl ? 'cursor-crosshair' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={handleImageClick}
            >
               {isDragging && (
                 <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                     <span className="text-rose-400 font-bold text-sm">释放上传图片</span>
                 </div>
               )}

               {displayImage ? (
                 <>
                    {/* Image Display */}
                    <img 
                        src={displayImage} 
                        alt="Character" 
                        className="w-full h-full object-contain pointer-events-none select-none" 
                        decoding="async" 
                    />
                    
                    {/* Visual Dots for Custom Edits - HIDDEN WHEN ROTATING */}
                    {!hasResult && !showRotationControl && customEdits.map((point, idx) => (
                        <div 
                            key={point.id}
                            className={`absolute w-4 h-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px] font-bold transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 ${point.label === '识别中...' ? 'bg-gray-400 animate-pulse' : 'bg-yellow-500 text-black'}`}
                            style={{ left: `${point.x}%`, top: `${point.y}%` }}
                        >
                            {idx + 1}
                        </div>
                    ))}

                    {/* Rotation Control Overlay */}
                    {showRotationControl && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-200 nodrag">
                             
                             {/* The Magic Cube Controller */}
                             <div 
                                className="w-12 h-12 relative cursor-grab active:cursor-grabbing mb-2 group nodrag"
                                onPointerDown={handleCubePointerDown}
                                onPointerMove={handleCubePointerMove}
                                onPointerUp={handleCubePointerUp}
                                style={{ perspective: '800px', touchAction: 'none' }}
                                title="上下左右拖动魔方来旋转"
                             >
                                 <div 
                                    className="w-full h-full relative transform-style-3d transition-transform duration-75"
                                    style={{ 
                                        transformStyle: 'preserve-3d', 
                                        transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
                                    }}
                                 >
                                    {/* Cube Faces */}
                                    <div className="absolute inset-0 bg-red-500/80 border border-white/30 backface-visible flex items-center justify-center text-[8px] font-bold text-white select-none" style={{ transform: 'translateZ(24px)' }}>前</div>
                                    <div className="absolute inset-0 bg-orange-500/80 border border-white/30 backface-visible flex items-center justify-center text-[8px] font-bold text-white select-none" style={{ transform: 'rotateY(180deg) translateZ(24px)' }}>后</div>
                                    <div className="absolute inset-0 bg-blue-500/80 border border-white/30 backface-visible flex items-center justify-center text-[8px] font-bold text-white select-none" style={{ transform: 'rotateY(90deg) translateZ(24px)' }}>右</div>
                                    <div className="absolute inset-0 bg-green-500/80 border border-white/30 backface-visible flex items-center justify-center text-[8px] font-bold text-white select-none" style={{ transform: 'rotateY(-90deg) translateZ(24px)' }}>左</div>
                                    <div className="absolute inset-0 bg-white/80 border border-white/30 backface-visible flex items-center justify-center text-[8px] font-bold text-black select-none" style={{ transform: 'rotateX(90deg) translateZ(24px)' }}>顶</div>
                                    <div className="absolute inset-0 bg-yellow-500/80 border border-white/30 backface-visible flex items-center justify-center text-[8px] font-bold text-black select-none" style={{ transform: 'rotateX(-90deg) translateZ(24px)' }}>底</div>
                                 </div>
                             </div>
                             
                             <div className="text-white text-xs font-bold bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none whitespace-nowrap">
                                {currentViewDetails.label}
                             </div>
                             
                             <div className="flex gap-2 bg-black/80 p-1.5 rounded-full backdrop-blur-sm border border-white/10">
                                <button onClick={confirmRotation} className="p-1 bg-green-600 hover:bg-green-500 rounded-full text-white transition-colors" title="应用视角 (Generate View)">
                                    <Check size={14} strokeWidth={3} />
                                </button>
                                <button onClick={cancelRotation} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded-full text-white transition-colors" title="取消">
                                    <X size={14} />
                                </button>
                             </div>
                        </div>
                    )}

                    <div className="absolute top-2 right-2 flex gap-1 z-20">
                        {/* Rotation Toggle Button */}
                        {!showRotationControl && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setShowRotationControl(true); }}
                                className="p-1.5 bg-black/60 hover:bg-black/80 hover:text-yellow-400 rounded-full text-white transition-colors nodrag"
                                title="更改人物视角 (Change View)"
                            >
                                <Box size={12} />
                            </button>
                        )}
                        
                        {hasResult && (
                             <button 
                                className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors nodrag"
                                onClick={handleClearResult}
                                title="返回原图"
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
                                className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-full text-white transition-colors nodrag"
                                onClick={clearUploadedImage}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                 </>
               ) : (
                 <label className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full h-full hover:bg-white/5 transition-colors p-4">
                    <UserCog className="text-gray-600" size={32} />
                    <span className="text-xs text-gray-500 text-center">拖入人物图片</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                 </label>
               )}
               
               {/* Analysis Overlay Button */}
               {!data.isAnalyzing && !data.isLoading && inputImage && !data.characterAttributes && !hasResult && !showRotationControl && (
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-10 transition-opacity hover:bg-black/20">
                        <button 
                            className="nodrag flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-full font-bold shadow-lg transform transition-transform hover:scale-105"
                            onClick={handleAnalyze}
                        >
                            <ScanFace size={18} />
                            开始分析 (Start Analysis)
                        </button>
                    </div>
               )}

               {data.isLoading && !data.isAnalyzing && (
                 <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-30">
                   <div className="flex flex-col items-center">
                     <Loader2 className="animate-spin text-rose-400 mb-2" size={32} />
                     <span className="text-xs text-rose-400 font-medium">生成中...</span>
                   </div>
                 </div>
               )}
            </div>
            
            {!hasResult && inputImage && !showRotationControl && (
                <div className="text-[10px] text-gray-500 text-center bg-white/5 p-1 rounded">
                    <MousePointerClick size={10} className="inline mr-1" />
                    点击图片添加自定义修改点位 (Click to add edit points)
                </div>
            )}
            
            {showRotationControl && (
                 <div className="text-[10px] text-yellow-500 text-center bg-yellow-900/20 p-1 rounded animate-pulse">
                    <RotateCw size={10} className="inline mr-1" />
                    拖动魔方调整视角. 点击对勾生成. (Drag to change view)
                </div>
            )}
            
            {data.error && (
                <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-900/50 break-words shrink-0 max-h-[60px] overflow-y-auto custom-scrollbar">
                    {data.error}
                </div>
            )}
        </div>

        {/* RIGHT SIDE: ATTRIBUTES EDITOR */}
        <div className="flex flex-col w-1/2 h-full bg-neutral-900/50 rounded-md border border-white/5 overflow-hidden">
             <div className="p-2 bg-white/5 border-b border-white/5 flex items-center justify-center shrink-0">
                 <div className="flex items-center gap-2 text-gray-300 text-xs font-bold uppercase tracking-wider">
                     <ScanFace size={14} className="text-rose-400" />
                     人物特征 (Attributes)
                 </div>
                 {data.isAnalyzing && (
                     <span className="text-[10px] text-rose-400 flex items-center gap-1 ml-auto">
                         <Loader2 size={10} className="animate-spin" /> 分析中...
                     </span>
                 )}
                 {!data.isAnalyzing && data.characterAttributes && (
                     <button 
                         onClick={handleAnalyze} 
                         className="text-[10px] text-gray-500 hover:text-rose-400 flex items-center gap-1 transition-colors ml-auto"
                         title="重新分析"
                     >
                         <RefreshCw size={10} /> 重新分析
                     </button>
                 )}
             </div>

             <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                 
                 {/* Custom Edits Section */}
                 {customEdits.length > 0 && (
                     <div className="border-b border-white/10 pb-3 mb-2">
                         <div className="text-[10px] text-yellow-500 font-bold uppercase mb-2 flex items-center gap-1">
                             <MousePointerClick size={10} />
                             自定义修改点 (Custom Edits)
                         </div>
                         <div className="space-y-2">
                             {customEdits.map((edit, idx) => (
                                 <div 
                                    key={edit.id} 
                                    className={`flex gap-2 items-start bg-yellow-900/10 p-2 rounded border animate-in slide-in-from-left-2 duration-300 transition-colors ${dragOverPointId === edit.id ? 'border-yellow-400 bg-yellow-900/30' : 'border-yellow-500/20'}`}
                                    onDragOver={(e) => handlePointDragOver(e, edit.id)}
                                    onDragLeave={handlePointDragLeave}
                                    onDrop={(e) => handlePointDrop(e, edit.id)}
                                 >
                                     <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5 ${edit.label === '识别中...' ? 'bg-gray-500 animate-pulse text-white' : 'bg-yellow-500 text-black'}`}>
                                         {idx + 1}
                                     </div>
                                     <div className="flex-1 space-y-1 min-w-0">
                                         <div className="flex justify-between items-center text-[9px] text-gray-400">
                                             <span>位置: {Math.round(edit.x)}%, {Math.round(edit.y)}%</span>
                                             {edit.label && (
                                                <span className={`px-1.5 rounded-full ${edit.label === '识别中...' ? 'bg-gray-700 text-gray-300 animate-pulse' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                                    {edit.label}
                                                </span>
                                             )}
                                         </div>
                                         <input 
                                             type="text"
                                             className="nodrag w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-yellow-500 outline-none"
                                             placeholder="例如: 改成蓝色眼睛..."
                                             value={edit.prompt}
                                             onChange={(e) => updateCustomEdit(edit.id, e.target.value)}
                                             onKeyDown={(e) => e.stopPropagation()}
                                         />
                                         
                                         {/* Reference Images Gallery for this point */}
                                         <div className="flex flex-wrap gap-1 pt-1">
                                             {edit.referenceImages?.map((refImg, refIdx) => (
                                                 <div key={refIdx} className="relative w-8 h-8 rounded border border-white/20 group/ref">
                                                     <img src={refImg} className="w-full h-full object-cover rounded-[2px]" alt="ref" />
                                                     <button 
                                                        onClick={() => removePointRefImage(edit.id, refIdx)}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/ref:opacity-100 transition-opacity"
                                                     >
                                                         <X size={8} />
                                                     </button>
                                                 </div>
                                             ))}
                                             {/* Drop hint */}
                                             {edit.referenceImages?.length === 0 && (
                                                 <div className="text-[9px] text-gray-600 italic flex items-center gap-1">
                                                     <ImagePlus size={10} /> 拖入参考图...
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                     <button 
                                         onClick={() => removeCustomEdit(edit.id)}
                                         className="text-gray-500 hover:text-red-400 p-1 self-start"
                                         title="删除点位"
                                     >
                                         <Trash2 size={12} />
                                     </button>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}

                 {/* Standard Attributes */}
                 <div className="space-y-3">
                     {Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => (
                         <div key={key} className="space-y-1">
                             <label className="text-[10px] text-gray-500 font-medium uppercase ml-1 block">{label}</label>
                             <textarea 
                                 className="nodrag w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 focus:text-white focus:border-rose-500 outline-none resize-none custom-scrollbar"
                                 rows={2}
                                 placeholder="..."
                                 value={data.characterAttributes?.[key] || ''}
                                 onChange={(e) => handleAttributeChange(key, e.target.value)}
                                 onKeyDown={(e) => e.stopPropagation()}
                             />
                         </div>
                     ))}
                 </div>
             </div>

             <div className="p-2 border-t border-white/10 bg-white/5 shrink-0">
                 <button 
                     className="nodrag w-full py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     onClick={handleGenerate}
                     disabled={data.isLoading || !inputImage}
                 >
                     <Wand2 size={14} />
                     {data.isLoading ? '生成中...' : '应用修改 (Generate)'}
                 </button>
             </div>
        </div>

      </div>
    </NodeWrapper>
  );
};