import React, { useMemo, useState } from 'react';
import { useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode } from '../../types';
import { ShoppingBag, Loader2, Download, Upload, Shirt, User, Scissors, Wand2, X, ScanLine, ArrowRight } from 'lucide-react';

const ETHNICITY_OPTIONS = [
  { label: '通用 (Universal)', value: 'Universal' },
  { label: '亚洲 (Asian)', value: 'Asian' },
  { label: '白人 (Caucasian)', value: 'Caucasian' },
  { label: '黑人 (Black)', value: 'Black' },
  { label: '拉丁 (Latino)', value: 'Latino' },
  { label: '印度 (Indian)', value: 'Indian' },
  { label: '中东 (Middle Eastern)', value: 'Middle Eastern' },
];

const GENDER_OPTIONS = [
  { label: '女性 (Female)', value: 'Female' },
  { label: '男性 (Male)', value: 'Male' },
  { label: '非二元 (Non-binary)', value: 'Non-binary' },
];

const AGE_OPTIONS = [
  { label: '儿童 (Child)', value: 'Child' },
  { label: '青少年 (Teen)', value: 'Teen' },
  { label: '青年 (Young Adult)', value: 'Young Adult' },
  { label: '成年 (Adult)', value: 'Adult' },
  { label: '老年 (Senior)', value: 'Senior' },
];

const SETTING_OPTIONS = [
  { label: '摄影棚 (Studio)', value: 'Studio' },
  { label: '街头 (Street)', value: 'Street' },
  { label: '自然 (Nature)', value: 'Nature' },
  { label: '室内 (Interior)', value: 'Interior' },
  { label: '抽象 (Abstract)', value: 'Abstract' },
  { label: '纯色 (Solid Color)', value: 'Solid Color' },
];

const STYLE_OPTIONS = [
  { label: '日常休闲 (Casual)', value: 'Casual' },
  { label: '商务正装 (Formal)', value: 'Formal' },
  { label: '潮流街头 (Streetwear)', value: 'Streetwear' },
  { label: '运动健身 (Sporty)', value: 'Sporty' },
  { label: '复古风 (Vintage)', value: 'Vintage' },
  { label: '极简主义 (Minimalist)', value: 'Minimalist' },
  { label: '波西米亚 (Bohemian)', value: 'Bohemian' },
  { label: '朋克/摇滚 (Punk/Rock)', value: 'Punk' },
];

export const EcommerceNode: React.FC<NodeProps<AppNode>> = ({ id, data, selected }) => {
  const edges = useEdges();
  const nodes = useNodes();
  const [isDragging, setIsDragging] = useState(false);

  const mode = data.ecommerceMode || 'model';
  
  const setMode = (m: 'model' | 'extract' | 'try_on' | 'ref_extract') => {
      if (data.setEcommerceMode) data.setEcommerceMode(m);
  };

  const updateAttributes = (key: string, value: string) => {
      const current = data.ecommerceAttributes || {};
      if (data.setEcommerceAttributes) data.setEcommerceAttributes({ ...current, [key]: value });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'original' | 'garment') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            if (target === 'original') {
                data.setUploadedImage?.(reader.result);
                if (data.onSelectImage) data.onSelectImage('');
            } else {
                data.setEcommerceGarmentImage?.(reader.result);
            }
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Helper for drag & drop
  const handleDrop = (e: React.DragEvent, target: 'original' | 'garment') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                if (target === 'original') {
                    data.setUploadedImage?.(reader.result);
                } else {
                    data.setEcommerceGarmentImage?.(reader.result);
                }
            }
        };
        reader.readAsDataURL(file);
    }
  };

  // Determine Inputs based on Mode
  
  // 1. Model Input (for Extract/Try-On)
  const inputModelImage = useMemo(() => {
    if (data.uploadedImage) return data.uploadedImage;
    const connection = edges.find(e => e.target === id && e.targetHandle === 'model');
    // If not specific 'model' handle, fallback to 'image' for extraction
    const connectionGeneric = edges.find(e => e.target === id && e.targetHandle === 'image');
    
    if (connection || connectionGeneric) {
        const srcId = (connection || connectionGeneric)?.source;
        const sourceNode = nodes.find(n => n.id === srcId) as AppNode;
        return sourceNode?.data.image || sourceNode?.data.uploadedImage;
    }
    
    // Fallback: If no upload/connection, verify if the current Result image (e.g. from previous run) can be used
    if (data.image && (mode === 'extract' || mode === 'try_on')) {
        return data.image; // Visual indicator that result is used as input
    }
    
    return undefined;
  }, [edges, nodes, id, data.uploadedImage, data.image, mode]);

  // 2. Garment Input (for Try-On and Ref-Extract)
  const inputGarmentImage = useMemo(() => {
    if (data.ecommerceGarmentImage) return data.ecommerceGarmentImage;
    const connection = edges.find(e => e.target === id && e.targetHandle === 'garment');
    if (connection) {
        const sourceNode = nodes.find(n => n.id === connection.source) as AppNode;
        return sourceNode?.data.image || sourceNode?.data.uploadedImage; // Or output of an Extract node
    }
    // Fallback for Ref Extract
    if (data.image && mode === 'ref_extract') {
        return data.image;
    }
    return undefined;
  }, [edges, nodes, id, data.ecommerceGarmentImage, data.image, mode]);

  const displayImage = data.image; // Result
  
  const getInputs = () => {
      if (mode === 'model') return [{ id: 'prompt', label: '提示词 (可选)' }];
      if (mode === 'extract') return [{ id: 'image', label: '原图' }];
      if (mode === 'ref_extract') return [{ id: 'garment', label: '参考图' }];
      if (mode === 'try_on') return [{ id: 'model', label: '模特图' }, { id: 'garment', label: '服装图' }];
      return [];
  };

  const handleRun = () => {
      if (data.onRun) data.onRun();
  };
  
  const downloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayImage) return;
    const link = document.createElement('a');
    link.href = displayImage;
    link.download = `ecommerce-${mode}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const clearImage = (target: 'original' | 'garment') => {
      if (target === 'original') data.setUploadedImage?.(undefined);
      else data.setEcommerceGarmentImage?.(undefined);
  }

  // Helper to detect if we are using the result as input (feedback)
  const isUsingResultAsInput = (target: 'original' | 'garment') => {
      if (target === 'original') {
          return inputModelImage === data.image && !data.uploadedImage && !edges.some(e => e.target === id && (e.targetHandle === 'model' || e.targetHandle === 'image'));
      } else {
          return inputGarmentImage === data.image && !data.ecommerceGarmentImage && !edges.some(e => e.target === id && e.targetHandle === 'garment');
      }
  };

  return (
    <NodeWrapper 
      title="电商设计 (E-Commerce)" 
      selected={selected} 
      inputs={getInputs()}
      outputs={[{ id: 'image', label: '成品图' }]}
      colorClass="border-sky-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-3 h-full min-w-[300px]">
        
        {/* Mode Selector */}
        <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
            <button onClick={() => setMode('model')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded transition-colors ${mode === 'model' ? 'bg-sky-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}>
                <User size={12} /> 模特生成
            </button>
             <button onClick={() => setMode('extract')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded transition-colors ${mode === 'extract' ? 'bg-sky-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}>
                <Scissors size={12} /> 衣物提取
            </button>
            <button onClick={() => setMode('ref_extract')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded transition-colors ${mode === 'ref_extract' ? 'bg-sky-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}>
                <ScanLine size={12} /> 参考提取
            </button>
            <button onClick={() => setMode('try_on')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded transition-colors ${mode === 'try_on' ? 'bg-sky-600 text-white shadow' : 'text-gray-400 hover:bg-white/5'}`}>
                <Shirt size={12} /> 虚拟试穿
            </button>
        </div>

        {/* Main Display / Input Area */}
        <div className="flex flex-col gap-2">
            
            {/* Result Display (Top priority if exists) */}
            {displayImage ? (
                <div className="relative w-full aspect-[3/4] bg-black/40 rounded-md overflow-hidden border border-sky-500/50 group">
                    <img src={displayImage} alt="Result" className="w-full h-full object-contain" />
                    <button onClick={downloadImage} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors">
                        <Download size={14} />
                    </button>
                    {data.isLoading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10">
                            <Loader2 className="animate-spin text-sky-400" size={32} />
                        </div>
                    )}
                </div>
            ) : (
                // Inputs based on mode (if no result yet)
                <div className="flex gap-2">
                    {/* Model Input Area (Used in Extract & Try-On) */}
                    {(mode === 'extract' || mode === 'try_on') && (
                        <div 
                            className={`relative flex-1 aspect-[3/4] bg-black/20 rounded border border-dashed border-white/10 hover:border-sky-500/50 transition-colors flex flex-col items-center justify-center cursor-pointer overflow-hidden group`}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => handleDrop(e, 'original')}
                        >
                            {inputModelImage ? (
                                <>
                                    <img src={inputModelImage} className="w-full h-full object-cover opacity-80" alt="Model" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-center text-gray-300 py-1">
                                        {isUsingResultAsInput('original') ? <span className="text-sky-300 flex items-center justify-center gap-1"><ArrowRight size={8} /> 使用上一步结果</span> : (mode === 'extract' ? '原图' : '模特图')}
                                    </div>
                                    {!isUsingResultAsInput('original') && !edges.some(e => e.target === id && (e.targetHandle === 'model' || e.targetHandle === 'image')) && (
                                         <button onClick={() => clearImage('original')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                                    )}
                                </>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                                    <Upload size={14} className="text-gray-500 mb-1" />
                                    <span className="text-[9px] text-gray-500">{mode === 'extract' ? '上传原图' : '上传模特'}</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'original')} />
                                </label>
                            )}
                        </div>
                    )}

                    {/* Garment Input Area (Used in Try-On AND Ref-Extract) */}
                    {(mode === 'try_on' || mode === 'ref_extract') && (
                         <div 
                            className={`relative flex-1 aspect-[3/4] bg-black/20 rounded border border-dashed border-white/10 hover:border-sky-500/50 transition-colors flex flex-col items-center justify-center cursor-pointer overflow-hidden group`}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => handleDrop(e, 'garment')}
                        >
                            {inputGarmentImage ? (
                                <>
                                    <img src={inputGarmentImage} className="w-full h-full object-cover opacity-80" alt="Garment" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-center text-gray-300 py-1">
                                        {isUsingResultAsInput('garment') ? <span className="text-sky-300 flex items-center justify-center gap-1"><ArrowRight size={8} /> 使用上一步结果</span> : (mode === 'ref_extract' ? '参考图' : '服装图')}
                                    </div>
                                    {!isUsingResultAsInput('garment') && !edges.some(e => e.target === id && e.targetHandle === 'garment') && (
                                         <button onClick={() => clearImage('garment')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                                    )}
                                </>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                                    <Shirt size={14} className="text-gray-500 mb-1" />
                                    <span className="text-[9px] text-gray-500">{mode === 'ref_extract' ? '上传参考图' : '上传服装'}</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'garment')} />
                                </label>
                            )}
                        </div>
                    )}
                    
                    {/* Placeholder for Model Gen Mode */}
                    {mode === 'model' && (
                        <div className="w-full aspect-[3/4] bg-white/5 rounded border border-white/5 flex items-center justify-center">
                            <User size={32} className="text-gray-700" />
                        </div>
                    )}
                </div>
            )}
            
            {/* If result exists BUT we are in a mode that needs secondary input, show secondary input below */}
            {displayImage && (
                 <div className="flex gap-2 h-[80px]">
                     {/* Show secondary inputs mini version if needed */}
                     {(mode === 'try_on') && !inputGarmentImage && (
                         <label className="flex-1 border border-dashed border-white/10 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 text-gray-500">
                             <span className="text-[8px]">上传服装以试穿</span>
                             <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'garment')} />
                         </label>
                     )}
                     
                     {/* Show visual indicator if we are implicitly using the result as source for the next step */}
                     {((mode === 'extract' && isUsingResultAsInput('original')) || 
                       (mode === 'ref_extract' && isUsingResultAsInput('garment'))) && (
                         <div className="w-full text-[10px] text-sky-400 bg-sky-900/20 p-1 rounded flex items-center justify-center gap-2">
                             <ArrowRight size={10} />
                             当前成品图将作为输入源
                         </div>
                     )}
                 </div>
            )}
        </div>
        
        {/* Controls / Attributes */}
        {mode === 'model' && (
            <div className="flex flex-col gap-2 bg-white/5 p-2 rounded border border-white/10">
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-gray-500 ml-1">人种 (Ethnicity)</span>
                        <select 
                            className="bg-black/40 text-[10px] text-gray-300 border border-white/10 rounded px-1 py-1.5 outline-none hover:border-sky-500/50 transition-colors"
                            value={data.ecommerceAttributes?.ethnicity || 'Universal'}
                            onChange={(e) => updateAttributes('ethnicity', e.target.value)}
                        >
                            {ETHNICITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-gray-500 ml-1">性别 (Gender)</span>
                        <select 
                            className="bg-black/40 text-[10px] text-gray-300 border border-white/10 rounded px-1 py-1.5 outline-none hover:border-sky-500/50 transition-colors"
                            value={data.ecommerceAttributes?.gender || 'Female'}
                            onChange={(e) => updateAttributes('gender', e.target.value)}
                        >
                            {GENDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-gray-500 ml-1">年龄 (Age)</span>
                        <select 
                            className="bg-black/40 text-[10px] text-gray-300 border border-white/10 rounded px-1 py-1.5 outline-none hover:border-sky-500/50 transition-colors"
                            value={data.ecommerceAttributes?.age || 'Young Adult'}
                            onChange={(e) => updateAttributes('age', e.target.value)}
                        >
                            {AGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-gray-500 ml-1">场景 (Setting)</span>
                        <select 
                            className="bg-black/40 text-[10px] text-gray-300 border border-white/10 rounded px-1 py-1.5 outline-none hover:border-sky-500/50 transition-colors"
                            value={data.ecommerceAttributes?.setting || 'Studio'}
                            onChange={(e) => updateAttributes('setting', e.target.value)}
                        >
                            {SETTING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                </div>

                {/* Clothing Style - Full Width */}
                <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-gray-500 ml-1">服装风格 (Style)</span>
                    <select 
                        className="bg-black/40 text-[10px] text-gray-300 border border-white/10 rounded px-1 py-1.5 outline-none hover:border-sky-500/50 transition-colors w-full"
                        value={data.ecommerceAttributes?.clothingStyle || 'Casual'}
                        onChange={(e) => updateAttributes('clothingStyle', e.target.value)}
                    >
                        {STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
            </div>
        )}

        {data.error && (
            <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded border border-red-900/50 break-words shrink-0">
                {data.error}
            </div>
        )}

        <button 
          className="nodrag flex items-center justify-center gap-2 w-full py-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white rounded-md font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          onClick={handleRun}
          disabled={data.isLoading}
        >
          {data.isLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {data.isLoading ? '处理中...' : (mode === 'model' ? '生成模特' : mode === 'extract' ? '提取服装' : mode === 'ref_extract' ? '提取参考' : '开始试穿')}
        </button>
      </div>
    </NodeWrapper>
  );
};