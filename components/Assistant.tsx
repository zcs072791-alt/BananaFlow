import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Loader2, Box, Smile, Zap, Layout, ShoppingBag, Layers, ImagePlus, FileStack, PenTool } from 'lucide-react';
import { planWorkflow, createSourceGenWorkflow, createVectorSepWorkflow, WorkflowPlan } from '../services/geminiService';

interface AssistantProps {
    onApplyWorkflow: (plan: WorkflowPlan) => void;
}

interface Message {
    role: 'user' | 'assistant';
    text: string;
    image?: string;
}

const QUICK_ACTIONS = [
    {
        id: 'source-gen',
        label: '源文件生成',
        icon: <FileStack size={14} className="text-cyan-400" />,
        prompt: "创建一个'源文件逆向生成'工作流。逻辑如下：\n1. 起始节点：如果没有图片，创建一个提示词节点；如果有图片，以图片为起点。\n2. 第一步：连接到一个'高清放大(Enhance)'节点，将画质变清晰。\n3. 第二步（图层拆分）：从'高清放大'节点的输出，并行连接到4个'魔法编辑(Edit)'节点，分别模拟图层：\n   - 节点A（主体层）：Prompt为 'Keep only the main subject, remove background, make background transparent'.\n   - 节点B（背景层）：Prompt为 'Remove the main subject, keep only the background, clean plate'.\n   - 节点C（线稿层）：Prompt为 'Convert to black and white line art, vector style outlines'.\n   - 节点D（色块层）：Prompt为 'Flat color segmentation, abstract color blocks, posterize'.\n请确保节点布局清晰，从左到右，从一开始的一条线变成四条分支。"
    },
    {
        id: 'vector-sep',
        label: '图片源文件 (Vector)',
        icon: <PenTool size={14} className="text-teal-400" />,
        prompt: "创建一个'矢量源文件生成'工作流，模拟VectorMagic逻辑。步骤：1.图片高清放大；2.转为矢量平涂风格；3.拆分为轮廓、主色、辅色、点缀色四个图层。"
    },
    {
        id: 'ip-set',
        label: 'IP全套设计',
        icon: <Layers size={14} className="text-purple-400" />,
        prompt: "帮我创建一个完整的IP角色设计工作流。包含：1. 一个核心的角色提示词节点；2. 连接到生成主形象的节点；3. 并行连接生成三视图、表情包和动作延展的节点。请合理布局。"
    },
    {
        id: 'three-view',
        label: '三视图',
        icon: <Box size={14} className="text-blue-400" />,
        prompt: "创建一个生成角色三视图（正面、侧面、背面）的工作流。用于3D建模参考，确保视图对其。"
    },
    {
        id: 'action',
        label: '动作延展',
        icon: <Zap size={14} className="text-yellow-400" />,
        prompt: "创建一个角色动态姿势延展的工作流。包含奔跑、跳跃、战斗等不同动作的生成节点，全部连接到同一个基础角色设定Prompt。"
    },
    {
        id: 'emoji',
        label: '表情包',
        icon: <Smile size={14} className="text-orange-400" />,
        prompt: "创建一个制作IP表情包的工作流。包含开心、生气、哭泣、惊讶等4-6个不同表情的生成节点，统一风格。"
    },
    {
        id: 'poster',
        label: '海报延展',
        icon: <Layout size={14} className="text-pink-400" />,
        prompt: "创建一个电影级宣传海报生成工作流。包含高清放大(Enhance)节点和修图(Edit)节点，用于生成高质量的营销物料。"
    },
    {
        id: 'merch',
        label: '周边延展',
        icon: <ShoppingBag size={14} className="text-green-400" />,
        prompt: "创建一个IP周边产品设计工作流。包含T恤印花、马克杯、手机壳和盲盒包装的设计生成节点。"
    }
];

export const Assistant: React.FC<AssistantProps> = ({ onApplyWorkflow }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', text: '你好！我是 Gemini 3 助手。我可以帮你设计工作流，请告诉我你想要什么？或者上传一张图片让我分析。' }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setAttachedImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
        // Reset input to allow re-selecting same file if needed
        e.target.value = '';
    };

    const processRequest = async (userMsg: string, image?: string) => {
        if (isLoading) return;
        setIsLoading(true);
        
        // Add user message to chat
        setMessages(prev => {
            // Prevent duplicate message if clicked from quick action (not perfect check but helps)
            if (prev.length > 0 && prev[prev.length - 1].text === userMsg && prev[prev.length - 1].role === 'user' && !image) return prev;
            return [...prev, { role: 'user', text: userMsg, image: image }];
        });

        try {
            const plan = await planWorkflow(userMsg, image);
            
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                text: `已为你生成: "${plan.description}"。正在应用到画布...` 
            }]);
            
            onApplyWorkflow(plan);
        } catch (err: any) {
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                text: `抱歉，生成工作流时遇到错误: ${err.message}` 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() && !attachedImage) return;
        
        const msg = input;
        const img = attachedImage || undefined;

        setInput('');
        setAttachedImage(null);
        
        await processRequest(msg, img);
    };

    const handleQuickAction = async (actionId: string, prompt: string) => {
        if (actionId === 'source-gen') {
            // Instant execution for Source File Gen
             setMessages(prev => [...prev, { 
                role: 'user', 
                text: '生成源文件工作流',
                image: attachedImage || undefined
            }]);
            
            try {
                const plan = createSourceGenWorkflow(attachedImage || undefined);
                
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    text: `已为你生成: "${plan.description}"。正在跳转源文件生成界面...` 
                }]);
    
                onApplyWorkflow(plan);
                
                // Reset input
                setInput('');
                setAttachedImage(null);
                setIsOpen(false); // Close assistant after jumping
            } catch (error: any) {
                 setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    text: `生成失败: ${error.message}` 
                }]);
            }
            return;
        }
        
        if (actionId === 'vector-sep') {
             setMessages(prev => [...prev, { 
                role: 'user', 
                text: '生成矢量源文件工作流',
                image: attachedImage || undefined
            }]);
            
            try {
                const plan = createVectorSepWorkflow(attachedImage || undefined);
                
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    text: `已为你生成: "${plan.description}"。正在跳转矢量生成界面...` 
                }]);
    
                onApplyWorkflow(plan);
                
                setInput('');
                setAttachedImage(null);
                setIsOpen(false);
            } catch (error: any) {
                 setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    text: `生成失败: ${error.message}` 
                }]);
            }
            return;
        }

        // Standard AI workflow generation
        await processRequest(prompt, attachedImage || undefined);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-[360px] bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-200 flex flex-col h-[550px]">
                    <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-3 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2 text-white font-semibold text-sm">
                            <Sparkles size={16} />
                            <span>Gemini 3 助手</span>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="text-white/80 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-900/95 custom-scrollbar">
                        {messages.map((msg, idx) => (
                            <div 
                                key={idx} 
                                className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                            >
                                {msg.image && (
                                    <div className="w-32 h-32 rounded-lg overflow-hidden border border-white/10 bg-black/20 mb-1">
                                        <img src={msg.image} alt="User upload" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div 
                                    className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                                        msg.role === 'user' 
                                            ? 'bg-yellow-600 text-white rounded-br-none' 
                                            : 'bg-white/10 text-gray-200 rounded-bl-none'
                                    }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                         <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="px-3 py-2 bg-neutral-800/50 border-t border-white/5 shrink-0">
                         <div className="text-[10px] text-gray-500 mb-2 font-medium px-1">常用工作流 (Presets)</div>
                         <div className="grid grid-cols-2 gap-2">
                            {QUICK_ACTIONS.map((action) => (
                                <button
                                    key={action.id}
                                    onClick={() => handleQuickAction(action.id, action.prompt)}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="p-1 bg-black/20 rounded group-hover:bg-black/40 transition-colors">
                                        {action.icon}
                                    </div>
                                    <span className="text-[11px] text-gray-300 group-hover:text-white font-medium">
                                        {action.label}
                                    </span>
                                </button>
                            ))}
                         </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-neutral-900 border-t border-white/10 shrink-0 flex flex-col gap-2">
                        {attachedImage && (
                            <div className="relative w-16 h-16 rounded-md overflow-hidden border border-yellow-500/50 group">
                                <img src={attachedImage} alt="Preview" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => setAttachedImage(null)}
                                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileSelect} 
                                accept="image/*" 
                                className="hidden" 
                            />
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-gray-400 hover:text-yellow-400 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                                title="上传图片"
                            >
                                <ImagePlus size={16} />
                            </button>
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={attachedImage ? "描述图片用途..." : "输入需求..."}
                                    className="w-full bg-black/30 border border-white/20 rounded-full pl-4 pr-10 py-2 text-xs text-white focus:outline-none focus:border-yellow-500 transition-colors"
                                    disabled={isLoading}
                                />
                                <button 
                                    type="submit"
                                    disabled={isLoading || (!input.trim() && !attachedImage)}
                                    className="absolute right-1 top-1 p-1.5 text-yellow-500 hover:text-yellow-400 disabled:opacity-50 disabled:text-gray-600 transition-colors"
                                >
                                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                title="Gemini 助手"
            >
                {isOpen ? <X size={24} /> : <Bot size={24} />}
            </button>
        </div>
    );
};