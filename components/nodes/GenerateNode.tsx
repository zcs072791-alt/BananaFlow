import React, { useMemo, useState } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode, PoseLandmark } from '../../types';
import { Wand2, Loader2, Image as ImageIcon, Upload, X, Check, Download, Ratio, ScanLine, Trash2 } from 'lucide-react';
import { detectPose } from '../../services/geminiService';

const CONNECTIONS = [
    ['nose', 'neck'],
    ['neck', 'right_shoulder'],
    ['neck', 'left_shoulder'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['neck', 'right_hip'],
    ['neck', 'left_hip'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_shoulder', 'right_hip'],
    ['left_shoulder', 'left_hip'],
    ['right_hip', 'left_hip']
];

// Consistent 3D Volumetric Colors
const getBoneColors = (start: string, end: string) => {
    // Torso (Blue)
    if (start.includes('hip') && end.includes('hip') || 
        (start.includes('shoulder') && end.includes('hip')) ||
        (start === 'neck')
       ) {
        return { dark: '#0f286e', mid: '#2563EB', light: '#60a5fa', width: 20 }; // Blue
    }
    
    // Right Arm (Red)
    if (start.includes('right') && (start.includes('shoulder') || start.includes('elbow'))) {
         return { dark: '#7f1d1d', mid: '#DC2626', light: '#f87171', width: 16 }; // Red
    }

    // Left Arm (Pink)
    if (start.includes('left') && (start.includes('shoulder') || start.includes('elbow'))) {
         return { dark: '#831843', mid: '#DB2777', light: '#f472b6', width: 16 }; // Pink
    }

    // Right Leg (Green)
    if (start.includes('right') && (start.includes('hip') || start.includes('knee'))) {
         return { dark: '#14532d', mid: '#16A34A', light: '#4ade80', width: 20 }; // Green
    }

     // Left Leg (Teal)
    if (start.includes('left') && (start.includes('hip') || start.includes('knee'))) {
         return { dark: '#134e4a', mid: '#0D9488', light: '#2dd4bf', width: 20 }; // Teal
    }
    
    // Head/Neck
    return { dark: '#854d0e', mid: '#FACC15', light: '#fef08a', width: 12 }; // Yellow
};

const getJointColor = (id: string) => {
    if (id.includes('right')) return '#DC2626';
    if (id.includes('left')) return '#0D9488';
    return '#FACC15';
};

export const GenerateNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();
  const [isDragging, setIsDragging] = useState(false);
  const [isDetectingPose, setIsDetectingPose] = useState(false);

  // Restore Local Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const promises = Array.from(files).map((file: File) => {
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') resolve(reader.result);
                else resolve('');
            };
            reader.readAsDataURL(file);
        });
    });
    Promise.all(promises).then(results => {
        results.filter(r => r).forEach(r => data.addReferenceImage?.(r));
    });
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
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

     const promises = Array.from(files).filter((f: File) => f.type.startsWith('image/')).map((file: File) => {
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') resolve(reader.result);
                else resolve('');
            };
            reader.readAsDataURL(file);
        });
    });
    Promise.all(promises).then(results => {
        results.filter(r => r).forEach(r => data.addReferenceImage?.(r));
    });
  };
  
  const connectedImages = useMemo(() => {
      const inputEdges = edges.filter(e => e.target === id && e.targetHandle === 'image');
      return inputEdges.map(e => {
          const node = nodes.find(n => n.id === e.source) as AppNode;
          return node?.data.image || node?.data.uploadedImage || node?.data.referenceImages?.[0];
      }).filter(Boolean) as string[];
  }, [edges, nodes, id]);

  const uploadedImages = data.referenceImages || [];
  const totalRefImagesCount = connectedImages.length + uploadedImages.length;
  const displayImage = data.image || (uploadedImages.length > 0 ? uploadedImages[0] : null) || (connectedImages.length > 0 ? connectedImages[0] : null);
  const isResult = !!data.image;
  const hasPose = data.poseLandmarks && data.poseLandmarks.length > 0;

  const downloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayImage) return;
    const link = document.createElement('a');
    link.href = displayImage;
    link.download = isResult ? `generated-${Date.now()}.png` : `reference-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDetectPose = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!displayImage) return;
      
      setIsDetectingPose(true);
      try {
          const landmarks = await detectPose(displayImage);
          if (data.setPoseLandmarks) {
              data.setPoseLandmarks(landmarks);
          }
      } catch (error) {
          console.error("Pose detection failed:", error);
      } finally {
          setIsDetectingPose(false);
      }
  };

  const clearPose = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.setPoseLandmarks) {
          data.setPoseLandmarks([]);
      }
  };

  const getCoords = (id: string) => data.poseLandmarks?.find(lm => lm.id === id);

  return (
    <NodeWrapper 
      title="文生图 / 图生图" 
      selected={selected} 
      inputs={[
        { id: 'prompt', label: '提示词' },
        { id: 'image', label: '参考图 (多张)' }
      ]}
      outputs={[{ id: 'image', label: '图片' }]}
      colorClass="border-yellow-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-3 h-full min-w-[250px]">
        
        <div 
            className={`relative flex-1 min-h-0 w-full bg-black/40 rounded-md overflow-hidden border transition-all flex items-center justify-center group ${isDragging ? 'border-yellow-400 bg-yellow-900/20' : 'border-white/5'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
           {isDragging && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                 <span className="text-yellow-400 font-bold text-sm">释放添加参考图</span>
             </div>
           )}

           {displayImage ? (
             <>
                <img src={displayImage} alt="Display" className="w-full h-full object-contain select-none" decoding="async" />
                
                {/* Pose Skeleton Overlay (3D Volumetric Style) */}
                {hasPose && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                        {CONNECTIONS.map(([start, end], idx) => {
                            const p1 = getCoords(start);
                            const p2 = getCoords(end);
                            if (p1 && p2) {
                                const colors = getBoneColors(start, end);
                                return (
                                    <g key={idx}>
                                        {/* Dark Edge */}
                                        <line 
                                            x1={`${p1.x}%`} y1={`${p1.y}%`}
                                            x2={`${p2.x}%`} y2={`${p2.y}%`}
                                            stroke={colors.dark}
                                            strokeWidth={colors.width}
                                            strokeLinecap="round"
                                        />
                                        {/* Mid Body */}
                                        <line 
                                            x1={`${p1.x}%`} y1={`${p1.y}%`}
                                            x2={`${p2.x}%`} y2={`${p2.y}%`}
                                            stroke={colors.mid}
                                            strokeWidth={colors.width * 0.7}
                                            strokeLinecap="round"
                                        />
                                        {/* Highlight */}
                                        <line 
                                            x1={`${p1.x}%`} y1={`${p1.y}%`}
                                            x2={`${p2.x}%`} y2={`${p2.y}%`}
                                            stroke={colors.light}
                                            strokeWidth={colors.width * 0.25}
                                            strokeLinecap="round"
                                            strokeOpacity={0.6}
                                        />
                                    </g>
                                );
                            }
                            return null;
                        })}
                        {data.poseLandmarks?.map((lm) => (
                            <foreignObject
                                key={lm.id}
                                x={`${lm.x}%`} y={`${lm.y}%`}
                                width="1" height="1"
                                className="overflow-visible"
                            >
                                <div
                                    className="transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                                    style={{
                                        background: `radial-gradient(circle at 35% 35%, white, ${getJointColor(lm.id)}, #000)`,
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                    }}
                                />
                            </foreignObject>
                        ))}
                    </svg>
                )}

                <div className="absolute top-2 right-2 flex gap-1 z-20">
                     {/* Pose Detection Button */}
                     {!isDetectingPose && !hasPose && (
                        <button 
                            onClick={handleDetectPose}
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="识别姿态 (Detect Pose)"
                        >
                            <ScanLine size={14} />
                        </button>
                    )}
                    {isDetectingPose && (
                         <div className="p-1.5 bg-black/60 rounded-full text-yellow-400">
                             <Loader2 size={14} className="animate-spin" />
                         </div>
                    )}
                    {hasPose && (
                         <button 
                            onClick={clearPose}
                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                            title="清除骨骼显示"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}

                    <button 
                        onClick={downloadImage}
                        className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="下载图片"
                    >
                        <Download size={14} />
                    </button>
                </div>
                
                {!isResult && (
                    <div className="absolute top-2 left-2 bg-yellow-900/60 text-yellow-200 text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 backdrop-blur-sm">
                        源图片 / 参考图
                    </div>
                )}
             </>
           ) : (
             <div className="text-center p-4 select-none">
                <ImageIcon className="mx-auto mb-2 text-gray-600" size={32} />
                <span className="text-xs text-gray-500 block">拖入图片或等待生成...</span>
             </div>
           )}
           
           {data.isLoading && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10">
               <div className="flex flex-col items-center">
                 <Loader2 className="animate-spin text-yellow-400 mb-2" size={32} />
                 <span className="text-xs text-yellow-400 font-medium">生成中...</span>
               </div>
             </div>
           )}
        </div>

        {data.gallery && data.gallery.length > 1 && (
           <div className="grid grid-cols-3 gap-1 p-1 bg-white/5 rounded border border-white/10 max-h-[80px] overflow-y-auto shrink-0">
              {data.gallery.map((img, idx) => (
                 <div 
                    key={idx} 
                    className={`relative aspect-square cursor-pointer rounded overflow-hidden border hover:border-yellow-500 transition-colors ${img === data.image ? 'border-yellow-400 ring-1 ring-yellow-400' : 'border-transparent'}`}
                    onClick={() => data.onSelectImage?.(img)}
                 >
                    <img src={img} className="w-full h-full object-cover" alt={`Batch ${idx}`} decoding="async" />
                    {img === data.image && (
                        <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center">
                            <Check size={12} className="text-white drop-shadow-md" />
                        </div>
                    )}
                 </div>
              ))}
           </div>
        )}

        <div 
            className={`bg-white/5 p-2 rounded border border-white/10 shrink-0 flex flex-col gap-2 transition-colors ${isDragging ? 'border-yellow-500/50 bg-yellow-900/10' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-semibold">参考图 (Reference Images)</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
                {connectedImages.map((img, idx) => (
                     <div key={`conn-${idx}`} className="relative aspect-square rounded overflow-hidden bg-black/20 border border-yellow-500/30 group/item">
                         <img src={img} className="w-full h-full object-cover opacity-80" alt={`Ref ${idx + 1}`} decoding="async" />
                         <div className="absolute top-0 left-0 bg-yellow-500 text-black text-[9px] font-bold px-1 rounded-br shadow-sm">
                             图{idx + 1}
                         </div>
                     </div>
                ))}

                {uploadedImages.map((img, idx) => (
                     <div key={`up-${idx}`} className="relative aspect-square rounded overflow-hidden bg-black/20 border border-white/10 group/item">
                         <img src={img} className="w-full h-full object-cover opacity-80" alt={`Ref ${connectedImages.length + idx + 1}`} decoding="async" />
                         <div className="absolute top-0 left-0 bg-gray-500 text-white text-[9px] font-bold px-1 rounded-br shadow-sm">
                             图{connectedImages.length + idx + 1}
                         </div>
                         <button 
                            onClick={() => data.removeReferenceImage?.(idx)}
                            className="absolute top-0 right-0 bg-red-500/80 hover:bg-red-600 text-white p-0.5 rounded-bl opacity-0 group-hover/item:opacity-100 transition-opacity"
                            title="删除图片"
                         >
                            <X size={10} />
                         </button>
                     </div>
                ))}
                
                <label className="flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/10 aspect-square rounded border border-dashed border-white/20 hover:border-yellow-500/50 transition-colors bg-black/20">
                     <Upload size={12} className="text-gray-400" />
                     <span className="text-[8px] text-gray-500">添加</span>
                     <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                </label>
            </div>

            {totalRefImagesCount === 0 && (
                <div className="text-[10px] text-gray-600 text-center py-1 select-none">
                   {isDragging ? '释放添加' : '拖入图片 / 点击添加'}
                </div>
            )}
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1 text-gray-400">
                <Ratio size={12} />
                <span className="text-[10px]">比例</span>
            </div>
            <select 
                className="bg-black/40 border border-white/20 rounded text-[10px] text-gray-200 px-2 py-1 focus:border-yellow-500 outline-none cursor-pointer w-[140px]"
                value={data.aspectRatio || "1:1"}
                onChange={(e) => data.setAspectRatio?.(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={data.disabled}
            >
                <optgroup label="常用 (Common)">
                    <option value="1:1">1:1 (正方形)</option>
                    <option value="4:3">4:3 (标准横屏)</option>
                    <option value="3:4">3:4 (标准竖屏)</option>
                    <option value="16:9">16:9 (宽屏)</option>
                    <option value="9:16">9:16 (手机竖屏)</option>
                </optgroup>
                <optgroup label="专业 (Pro)">
                    <option value="3:2">3:2 (单反横屏)</option>
                    <option value="2:3">2:3 (单反竖屏)</option>
                    <option value="21:9">21:9 (电影宽屏)</option>
                    <option value="9:21">9:21 (超长竖屏)</option>
                    <option value="4:5">4:5 (社交媒体)</option>
                    <option value="5:4">5:4 (传统画幅)</option>
                </optgroup>
            </select>
        </div>

        {data.error && (
            <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-900/50 break-words shrink-0">
                {data.error}
            </div>
        )}

        <button 
          className="nodrag flex items-center justify-center gap-2 w-full py-2 bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          onClick={data.onRun}
          disabled={data.isLoading}
        >
          <Wand2 size={14} />
          {data.isLoading ? '正在思考...' : '开始生成'}
        </button>
      </div>
    </NodeWrapper>
  );
};