import React, { useRef } from 'react';
import { NodeType } from '../types';
import { 
  MessageSquare, 
  Wand2, 
  Paintbrush, 
  Sparkles, 
  Brush, 
  Upload, 
  Save, 
  Trash2, 
  Video, 
  ShoppingBag,
  ScanFace,
  Move,
  PenTool,
  ScanText,
  Expand,
  Minimize2
} from 'lucide-react';

interface SidebarProps {
  onSave?: () => void;
  onLoad?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onSave, onLoad, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-64 bg-neutral-900 border-r border-white/10 p-4 flex flex-col gap-4 h-full font-sans shrink-0 z-10 relative">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-yellow-400">🍌</span> BananaFlow
        </h1>
        <p className="text-xs text-gray-400 mt-1">拖拽节点到画布以开始创作</p>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.PROMPT)}
            draggable={true}
        >
            <MessageSquare className="text-purple-400" size={20} />
            <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">提示词 (Prompt)</span>
                <span className="text-[10px] text-gray-500">输入文本指令</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.GENERATE)}
            draggable={true}
        >
            <Wand2 className="text-yellow-400" size={20} />
            <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">文生图 / 图生图</span>
                <span className="text-[10px] text-gray-500">文本 + 可选图片生成</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.ECOMMERCE)}
            draggable={true}
        >
            <ShoppingBag className="text-sky-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">电商设计 (E-Commerce)</span>
                <span className="text-[10px] text-gray-500">模特生成 / 试穿 / 提取</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.CHARACTER_EDIT)}
            draggable={true}
        >
            <ScanFace className="text-rose-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">人物编辑 (Character)</span>
                <span className="text-[10px] text-gray-500">识别特征 + 精细修改</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.POSE)}
            draggable={true}
        >
            <Move className="text-lime-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">姿态编辑 (Pose)</span>
                <span className="text-[10px] text-gray-500">识别骨骼 + 动作迁移</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.DRAW)}
            draggable={true}
        >
            <PenTool className="text-fuchsia-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">手绘生图 (Sketch)</span>
                <span className="text-[10px] text-gray-500">画板涂鸦 + 生成</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.IMAGE_TO_TEXT)}
            draggable={true}
        >
            <ScanText className="text-cyan-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">提示词提取</span>
                <span className="text-[10px] text-gray-500">图片转文本 (Image to Text)</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.VIDEO)}
            draggable={true}
        >
            <Video className="text-pink-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">视频生成 (Veo)</span>
                <span className="text-[10px] text-gray-500">文生视频 / 图生视频</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.EDIT)}
            draggable={true}
        >
            <Paintbrush className="text-blue-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">魔法编辑 (Edit)</span>
                <span className="text-[10px] text-gray-500">图片 + 指令修改</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.OUTPAINT)}
            draggable={true}
        >
            <Expand className="text-indigo-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">图片扩展 (Outpaint)</span>
                <span className="text-[10px] text-gray-500">向外填充扩展画面</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.INPAINT)}
            draggable={true}
        >
            <Brush className="text-orange-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">局部重绘 (Inpaint)</span>
                <span className="text-[10px] text-gray-500">涂抹遮罩 + 修改</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.ENHANCE)}
            draggable={true}
        >
            <Sparkles className="text-emerald-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">高清放大 (Enhance)</span>
                <span className="text-[10px] text-gray-500">Pro 模型细节增强</span>
            </div>
        </div>

        <div 
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors"
            onDragStart={(event) => onDragStart(event, NodeType.COMPRESSION)}
            draggable={true}
        >
            <Minimize2 className="text-teal-400" size={20} />
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">图片压缩 (Compression)</span>
                <span className="text-[10px] text-gray-500">无损/有损 格式转换</span>
            </div>
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 space-y-2">
         {/* Utility Buttons */}
         <div className="flex gap-2">
            <button 
                onClick={onClear}
                className="flex-1 flex items-center justify-center gap-2 bg-red-900/30 hover:bg-red-900/50 text-red-200 py-2 rounded text-xs border border-red-900/50 transition-colors"
            >
                <Trash2 size={14} />
                清空画布
            </button>
         </div>

         {/* File Operations */}
         <div className="flex gap-2">
            <button 
                onClick={onSave}
                className="flex-1 flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded text-xs border border-white/10 transition-colors"
            >
                <Save size={14} />
                保存工作流
            </button>
            <button 
                onClick={handleImportClick}
                className="flex-1 flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded text-xs border border-white/10 transition-colors"
            >
                <Upload size={14} />
                导入
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onLoad} 
                accept=".json" 
                className="hidden" 
            />
         </div>
         <div className="text-[9px] text-gray-600 text-center pt-2">
            Powered by Gemini Nano Banana & Pro Image Models
         </div>
      </div>
    </div>
  );
};