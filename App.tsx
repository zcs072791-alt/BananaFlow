import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  useReactFlow,
  BackgroundVariant,
} from '@xyflow/react';
import type { Connection } from '@xyflow/react';
import { NodeType, AppNode, NodeData, AppEdge, CharacterAttributes, PoseLandmark } from './types';
import { PromptNode } from './components/nodes/PromptNode';
import { GenerateNode } from './components/nodes/GenerateNode';
import { EditNode } from './components/nodes/EditNode';
import { EnhanceNode } from './components/nodes/EnhanceNode';
import { InpaintNode } from './components/nodes/InpaintNode';
import { VideoNode } from './components/nodes/VideoNode';
import { ImageToTextNode } from './components/nodes/ImageToTextNode';
import { OutpaintNode } from './components/nodes/OutpaintNode';
import { CompressionNode } from './components/nodes/CompressionNode';
import { DrawNode } from './components/nodes/DrawNode';
import { CharacterEditNode } from './components/nodes/CharacterEditNode';
import { PoseNode } from './components/nodes/PoseNode';
import { EcommerceNode } from './components/nodes/EcommerceNode';
import { Sidebar } from './components/Sidebar';
import { Assistant } from './components/Assistant';
import { 
  WorkflowPlan, 
  getQueueStatus, 
  generateImage, 
  sketchToImage, 
  editImage, 
  enhanceImage, 
  inpaintImage, 
  generateVideo, 
  generateSpriteSheet, 
  imageToText, 
  extendImage,
  analyzeCharacter,
  generateCharacterFromAttributes,
  detectPose,
  describePose,
  generateFromPose,
  generatePoseFromText,
  generateEcommerceImage
} from './services/geminiService';
import { saveAutoSnapshot, getSnapshots, WorkflowSnapshot, saveWorkflowToFile } from './services/storageService';
import { ToastContainer, ToastMessage, ToastType } from './components/ui/Toast';
import { RestoreModal } from './components/ui/RestoreModal';
import { Activity } from 'lucide-react';

const nodeTypes = {
  [NodeType.PROMPT]: PromptNode,
  [NodeType.GENERATE]: GenerateNode,
  [NodeType.EDIT]: EditNode,
  [NodeType.ENHANCE]: EnhanceNode,
  [NodeType.INPAINT]: InpaintNode,
  [NodeType.VIDEO]: VideoNode,
  [NodeType.IMAGE_TO_TEXT]: ImageToTextNode,
  [NodeType.OUTPAINT]: OutpaintNode,
  [NodeType.COMPRESSION]: CompressionNode,
  [NodeType.DRAW]: DrawNode,
  [NodeType.CHARACTER_EDIT]: CharacterEditNode,
  [NodeType.POSE]: PoseNode,
  [NodeType.ECOMMERCE]: EcommerceNode,
};

const initialNodes: AppNode[] = [
  {
    id: '1',
    type: NodeType.PROMPT,
    position: { x: 100, y: 200 },
    data: { text: '一只穿着宇航服的香蕉，在太空中漂浮，赛博朋克风格' },
  },
];

let id = 0;
const getId = () => `dndnode_${Date.now()}_${id++}`;

const getNodeImage = (node: AppNode | undefined, currentNodes: AppNode[], currentEdges: AppEdge[], visited = new Set<string>()): string | undefined => {
    if (!node || visited.has(node.id)) return undefined;
    visited.add(node.id);
    if (node.data.image) return node.data.image;
    if (node.data.uploadedImage) return node.data.uploadedImage;
    if (node.data.referenceImages && node.data.referenceImages.length > 0) return node.data.referenceImages[0];
    if (node.data.sketch) return node.data.sketch;
    const inputEdge = currentEdges.find(e => e.target === node.id && e.targetHandle === 'image');
    if (inputEdge) {
        const sourceNode = currentNodes.find(n => n.id === inputEdge.source);
        if (sourceNode) {
            return getNodeImage(sourceNode, currentNodes, currentEdges, visited);
        }
    }
    return undefined;
};

// BananaFlow component starts
const BananaFlow = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const clipboardRef = useRef<AppNode | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [queueStatus, setQueueStatus] = useState({ queueLength: 0, isWaiting: false });
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [savedSnapshots, setSavedSnapshots] = useState<WorkflowSnapshot[]>([]);
  const [isRestored, setIsRestored] = useState(false);
  const { screenToFlowPosition, fitView, getNodes, getEdges } = useReactFlow<AppNode, AppEdge>();

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts(prev => [...prev, { id, message, type }]);
  }, []);
  const removeToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)); }, []);
  useEffect(() => { const interval = setInterval(() => { setQueueStatus(getQueueStatus()); }, 500); return () => clearInterval(interval); }, []);
  const updateNodeData = useCallback((nodeId: string, newData: Partial<NodeData>) => {
    setNodes((nds) => nds.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node));
  }, [setNodes]);

  // --- Handlers ---
  const handleGenerate = useCallback(async (nodeId: string) => {
      const currentNode = getNodes().find(n => n.id === nodeId);
      if (currentNode?.data.disabled) return;
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const inputEdges = currentEdges.filter((e) => e.target === nodeId);
      const promptEdges = inputEdges.filter(e => e.targetHandle === 'prompt') || [];
      if (promptEdges.length === 0) {
         const connectedPromptEdges = inputEdges.filter(e => {
            const n = currentNodes.find(n => n.id === e.source);
            return n?.type === NodeType.PROMPT || n?.type === NodeType.IMAGE_TO_TEXT;
         });
         promptEdges.push(...connectedPromptEdges);
      }
      if (promptEdges.length === 0) { updateNodeData(nodeId, { error: '请连接至少一个提示词节点！' }); return; }
      const promptTexts: string[] = [];
      const uniquePromptIds = new Set(promptEdges.map(e => e.source));
      uniquePromptIds.forEach(sourceId => {
        const sourceNode = currentNodes.find(n => n.id === sourceId);
        if (sourceNode?.data.text && !sourceNode.data.disabled) promptTexts.push(sourceNode.data.text);
      });
      if (promptTexts.length === 0) { updateNodeData(nodeId, { error: '源节点没有输入文本或已被禁用。' }); return; }
      const allReferenceImages: string[] = [];
      const imageEdges = inputEdges.filter(e => e.targetHandle === 'image' || (!uniquePromptIds.has(e.source) && currentNodes.find(n => n.id === e.source)?.type !== NodeType.PROMPT));
      imageEdges.forEach(edge => {
        const imgNode = currentNodes.find(n => n.id === edge.source);
        if (imgNode && !imgNode.data.disabled) {
            const img = getNodeImage(imgNode, currentNodes, currentEdges);
            if (img) allReferenceImages.push(img);
        }
      });
      if (currentNode?.data.referenceImages) allReferenceImages.push(...currentNode.data.referenceImages);
      if (currentNode?.data.uploadedImage && !currentNode.data.referenceImages) allReferenceImages.push(currentNode.data.uploadedImage);
      if (currentNode?.data.sketch) allReferenceImages.push(currentNode.data.sketch);
      updateNodeData(nodeId, { isLoading: true, error: undefined, gallery: [] });
      try {
        const promises = promptTexts.map(prompt => generateImage(prompt, allReferenceImages, currentNode?.data.aspectRatio));
        const results = await Promise.all(promises);
        updateNodeData(nodeId, { image: results[0], gallery: results, isLoading: false });
        addToast("图片生成成功！", "success");
      } catch (err: any) {
        updateNodeData(nodeId, { isLoading: false, error: '生成失败: ' + err.message });
        addToast("生成失败: " + err.message, "error");
      }
  }, [getNodes, getEdges, updateNodeData, addToast]);

  const handlePoseAction = useCallback(async (nodeId: string, payload?: { type: 'detect' | 'generate' | 'analyze_ref', image?: string }) => {
      const currentNode = getNodes().find(n => n.id === nodeId);
      if (currentNode?.data.disabled) return;
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const inputEdges = currentEdges.filter(e => e.target === nodeId);
      let inputImage = currentNode?.data.uploadedImage;
      if (!inputImage) {
          const imageEdge = inputEdges.find(e => e.targetHandle === 'image');
          if (imageEdge) {
              const srcNode = currentNodes.find(n => n.id === imageEdge.source);
              if (srcNode && !srcNode.data.disabled) inputImage = getNodeImage(srcNode, currentNodes, currentEdges);
          }
      }
      if (payload?.type === 'analyze_ref') {
          if (!payload.image) return;
          updateNodeData(nodeId, { isLoading: true, error: undefined, poseReferenceImage: payload.image });
          try {
              const description = await describePose(payload.image);
              updateNodeData(nodeId, { poseDescription: description, isLoading: false });
          } catch (err: any) {
              updateNodeData(nodeId, { isLoading: false, error: "描述提取失败" });
          }
      } else if (payload?.type === 'detect') {
          if (!inputImage) { updateNodeData(nodeId, { error: '请上传或连接原图进行识别' }); return; }
          updateNodeData(nodeId, { isLoading: true, isAnalyzing: true, error: undefined });
          try {
              const [landmarks, description] = await Promise.all([detectPose(inputImage), describePose(inputImage)]);
              updateNodeData(nodeId, { poseLandmarks: landmarks, poseDescription: description, isLoading: false, isAnalyzing: false });
          } catch (err: any) {
              updateNodeData(nodeId, { isLoading: false, isAnalyzing: false, error: err.message });
          }
      } else if (payload?.type === 'generate') {
           const mode = currentNode?.data.poseControlMode || 'skeleton';
           let prompt = currentNode?.data.poseDescription || "A character in this pose";
           const promptEdge = inputEdges.find(e => e.targetHandle === 'prompt');
           if (promptEdge) {
               const pNode = currentNodes.find(n => n.id === promptEdge.source);
               if (pNode && pNode.data.text) prompt = currentNode?.data.poseDescription ? `${currentNode.data.poseDescription}. ${pNode.data.text}` : pNode.data.text;
           }
           updateNodeData(nodeId, { isLoading: true, isAnalyzing: false, error: undefined });
           try {
               let result = '';
               if (mode === 'skeleton') {
                    if (!currentNode?.data.poseLandmarks || currentNode.data.poseLandmarks.length === 0) throw new Error('没有骨骼数据');
                    if (!inputImage) throw new Error('需要原图');
                    // Use skeleton + original logic
                    // We assume generateFromPose is available or fallback
                    // Here using generateFromPose which uses skeleton image. 
                    // But we don't have skeleton image generated on canvas. 
                    // Using text fallback for now or robust implementation
                    result = await generatePoseFromText(inputImage, prompt, "1:1");
               } else {
                    if (!inputImage) throw new Error('需要原图');
                    result = await generatePoseFromText(inputImage, prompt, "1:1");
               }
               updateNodeData(nodeId, { image: result, isLoading: false });
           } catch (err: any) {
               updateNodeData(nodeId, { isLoading: false, error: err.message });
           }
      }
  }, [getNodes, getEdges, updateNodeData, addToast]);

  const handleDraw = useCallback(async (nodeId: string) => {
      const currentNode = getNodes().find(n => n.id === nodeId);
      if (currentNode?.data.disabled) return;
      const sketch = currentNode?.data.sketch;
      if (!sketch) { updateNodeData(nodeId, { error: '画布为空' }); return; }
      updateNodeData(nodeId, { isLoading: true });
      try {
          const result = await sketchToImage("Enhance this sketch", sketch);
          updateNodeData(nodeId, { image: result, isLoading: false });
      } catch (e: any) { updateNodeData(nodeId, { isLoading: false, error: e.message }); }
  }, [getNodes, updateNodeData]);

  const handleCharacterEdit = useCallback(async (nodeId: string, payload?: any) => {
      const currentNode = getNodes().find(n => n.id === nodeId);
      const inputImage = currentNode?.data.uploadedImage || getNodeImage(getNodes().find(n => getEdges().find(e => e.target === nodeId && e.targetHandle === 'image')?.source === n.id), getNodes(), getEdges());
      if (!inputImage) { updateNodeData(nodeId, { error: '无图片' }); return; }
      if (payload?.type === 'analyze') {
          updateNodeData(nodeId, { isAnalyzing: true });
          try {
              const attrs = await analyzeCharacter(inputImage);
              updateNodeData(nodeId, { characterAttributes: attrs, isAnalyzing: false });
          } catch (e: any) { updateNodeData(nodeId, { isAnalyzing: false, error: e.message }); }
      } else {
          updateNodeData(nodeId, { isLoading: true });
          try {
              const res = await generateCharacterFromAttributes(inputImage, currentNode?.data.characterAttributes || {});
              updateNodeData(nodeId, { image: res, isLoading: false });
          } catch (e: any) { updateNodeData(nodeId, { isLoading: false, error: e.message }); }
      }
  }, [getNodes, getEdges, updateNodeData]);

  const handleEcommerce = useCallback(async (nodeId: string) => {
      const currentNode = getNodes().find(n => n.id === nodeId);
      if (currentNode?.data.disabled) return;
      
      const mode = currentNode?.data.ecommerceMode || 'model';
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const inputEdges = currentEdges.filter(e => e.target === nodeId);

      // Resolve Inputs
      let modelImg = currentNode?.data.uploadedImage;
      if (!modelImg) {
          const edge = inputEdges.find(e => e.targetHandle === 'model' || e.targetHandle === 'image');
          if (edge) {
             const src = currentNodes.find(n => n.id === edge.source);
             if (src) modelImg = getNodeImage(src, currentNodes, currentEdges);
          }
      }
      
      // FALLBACK: Use generated result as input if available (Chaining)
      if (!modelImg && currentNode?.data.image && (mode === 'extract' || mode === 'try_on')) {
          modelImg = currentNode.data.image;
      }

      let garmentImg = currentNode?.data.ecommerceGarmentImage;
      if (!garmentImg) {
          const edge = inputEdges.find(e => e.targetHandle === 'garment');
          if (edge) {
             const src = currentNodes.find(n => n.id === edge.source);
             if (src) garmentImg = getNodeImage(src, currentNodes, currentEdges);
          }
      }
      
      // FALLBACK for Ref Extract: Use generated result as garment input
      if (!garmentImg && currentNode?.data.image && mode === 'ref_extract') {
          garmentImg = currentNode.data.image;
      }

      // Prompt
      let prompt = "";
      const promptEdge = inputEdges.find(e => e.targetHandle === 'prompt');
      if (promptEdge) {
          const src = currentNodes.find(n => n.id === promptEdge.source);
          if (src && src.data.text) prompt = src.data.text;
      }

      updateNodeData(nodeId, { isLoading: true, error: undefined });
      
      try {
          const result = await generateEcommerceImage(
              mode,
              { model: modelImg, garment: garmentImg, original: modelImg },
              currentNode?.data.ecommerceAttributes,
              prompt
          );
          updateNodeData(nodeId, { image: result, isLoading: false });
          addToast("电商任务完成", "success");
      } catch (e: any) {
          updateNodeData(nodeId, { isLoading: false, error: e.message });
          addToast("任务失败: " + e.message, "error");
      }
  }, [getNodes, getEdges, updateNodeData, addToast]);

  const handleImageToText = useCallback(async (nodeId: string) => {
      const currentNode = getNodes().find(n => n.id === nodeId);
      if (currentNode?.data.disabled) return;
      
      let inputImage = currentNode?.data.uploadedImage;
      if (!inputImage) {
          const edge = getEdges().find(e => e.target === nodeId && e.targetHandle === 'image');
          if (edge) {
             const srcNode = getNodes().find(n => n.id === edge.source);
             if (srcNode) inputImage = getNodeImage(srcNode, getNodes(), getEdges());
          }
      }
      
      if (!inputImage) {
          updateNodeData(nodeId, { error: '请先上传图片或连接图片节点' });
          return;
      }

      updateNodeData(nodeId, { isLoading: true, error: undefined });
      try {
          const result = await imageToText(inputImage);
          updateNodeData(nodeId, { text: result, isLoading: false });
          addToast("提示词提取成功", "success");
      } catch (e: any) {
          updateNodeData(nodeId, { isLoading: false, error: e.message });
          addToast("提取失败: " + e.message, "error");
      }
  }, [getNodes, getEdges, updateNodeData, addToast]);

  const hydrateNode = useCallback((node: AppNode): AppNode => {
      return {
          ...node,
          data: {
              ...node.data,
              onTextChange: (val) => updateNodeData(node.id, { text: val }),
              onStyleChange: (val) => updateNodeData(node.id, { style: val }),
              setMask: (val) => updateNodeData(node.id, { mask: val }),
              setSketch: (val) => updateNodeData(node.id, { sketch: val }),
              setStrokeLayer: (val) => updateNodeData(node.id, { strokeLayer: val }),
              setUploadedImage: (val) => updateNodeData(node.id, { uploadedImage: val }),
              setCharacterAttributes: (val) => updateNodeData(node.id, { characterAttributes: val }),
              setPoseLandmarks: (val) => updateNodeData(node.id, { poseLandmarks: val }),
              setPoseDescription: (val) => updateNodeData(node.id, { poseDescription: val }),
              setPoseReferenceImage: (val) => updateNodeData(node.id, { poseReferenceImage: val }),
              setPoseControlMode: (val) => updateNodeData(node.id, { poseControlMode: val }),
              setEcommerceMode: (val) => updateNodeData(node.id, { ecommerceMode: val }),
              setEcommerceAttributes: (val) => updateNodeData(node.id, { ecommerceAttributes: val }),
              setEcommerceGarmentImage: (val) => updateNodeData(node.id, { ecommerceGarmentImage: val }),
              addReferenceImage: (img) => setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, referenceImages: [...(n.data.referenceImages||[]), img] } } : n)),
              removeReferenceImage: (idx) => setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, referenceImages: (n.data.referenceImages||[]).filter((_, i) => i !== idx) } } : n)),
              onSelectImage: (img) => updateNodeData(node.id, { image: img }),
              setAspectRatio: (val) => updateNodeData(node.id, { aspectRatio: val }),
              setDirection: (val) => updateNodeData(node.id, { direction: val }),
              setVideoType: (val) => updateNodeData(node.id, { videoType: val }),
              setFrameCount: (val) => updateNodeData(node.id, { frameCount: val }),
              setFrameOffsets: (val) => updateNodeData(node.id, { frameOffsets: val }),
              setCompressionFormat: (val) => updateNodeData(node.id, { compressionFormat: val }),
              setCompressionQuality: (val) => updateNodeData(node.id, { compressionQuality: val }),
              setCompressionScale: (val) => updateNodeData(node.id, { compressionScale: val }),
              onRun: (payload) => {
                  if (node.type === NodeType.GENERATE) handleGenerate(node.id);
                  else if (node.type === NodeType.POSE) handlePoseAction(node.id, payload);
                  else if (node.type === NodeType.DRAW) handleDraw(node.id);
                  else if (node.type === NodeType.CHARACTER_EDIT) handleCharacterEdit(node.id, payload);
                  else if (node.type === NodeType.ECOMMERCE) handleEcommerce(node.id);
                  else if (node.type === NodeType.IMAGE_TO_TEXT) handleImageToText(node.id);
              },
              onDelete: () => {
                  setNodes((nds) => nds.filter((n) => n.id !== node.id));
                  setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
              },
              onCopy: () => {
                  const n = getNodes().find(n => n.id === node.id);
                  if (n) { clipboardRef.current = JSON.parse(JSON.stringify({ ...n, data: { ...n.data, isLoading: false, error: undefined } })); addToast("Copied"); }
              },
              onCut: () => {
                  const n = getNodes().find(n => n.id === node.id);
                  if (n) { clipboardRef.current = JSON.parse(JSON.stringify({ ...n, data: { ...n.data, isLoading: false, error: undefined } })); setNodes(nds => nds.filter(x => x.id !== node.id)); addToast("Cut"); }
              },
              onToggleDisabled: () => setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, disabled: !n.data.disabled } } : n)),
          }
      };
  }, [updateNodeData, handleGenerate, handlePoseAction, handleDraw, handleCharacterEdit, handleEcommerce, handleImageToText, setNodes, addToast, getNodes]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#facc15', strokeWidth: 2 } }, eds)), [setEdges]);
  const onDrop = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode = hydrateNode({ id: getId(), type, position, data: {} });
      setNodes((nds) => nds.concat(newNode));
  }, [screenToFlowPosition, setNodes, hydrateNode]);

  useEffect(() => {
      const checkSnapshots = async () => {
          const snapshots = await getSnapshots();
          if (snapshots.length > 0) { setSavedSnapshots(snapshots); setShowRestoreModal(true); }
          else { setNodes(initialNodes.map(n => hydrateNode(n))); setIsRestored(true); }
      };
      checkSnapshots();
  }, [hydrateNode]);

  useEffect(() => {
      if (isRestored) {
          const interval = setInterval(() => {
             saveAutoSnapshot(getNodes(), getEdges());
          }, 30000);
          return () => clearInterval(interval);
      }
  }, [isRestored, getNodes, getEdges]);

  // Handle Workflow Save / Load
  const handleSaveWorkflow = useCallback(() => {
      saveWorkflowToFile(getNodes(), getEdges());
  }, [getNodes, getEdges]);

  const handleRestoreWorkflow = useCallback((flow: { nodes: AppNode[], edges: AppEdge[] }) => {
      // Clear current flow
      setNodes([]);
      setEdges([]);
      
      setTimeout(() => {
          // Re-hydrate nodes with handlers and restore state
          const hydratedNodes = flow.nodes.map(node => hydrateNode(node));
          setNodes(hydratedNodes);
          setEdges(flow.edges);
          setTimeout(() => fitView({ padding: 0.2 }), 100);
          addToast("工作流导入成功", "success");
      }, 50);
  }, [hydrateNode, setNodes, setEdges, fitView, addToast]);

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden font-sans relative">
      <Sidebar 
          onSave={handleSaveWorkflow} 
          onRestore={handleRestoreWorkflow} 
          onClear={() => { setNodes([]); setEdges([]); }} 
      />
      <div className="flex-grow h-full relative" ref={reactFlowWrapper}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onDrop={onDrop} onDragOver={(e)=>e.preventDefault()} nodeTypes={nodeTypes} fitView className="bg-black">
          <Background color="#333" gap={20} variant={BackgroundVariant.Dots} />
          <Controls className="bg-neutral-800 border-white/10 fill-white text-white" />
        </ReactFlow>
      </div>
      <RestoreModal isOpen={showRestoreModal} snapshots={savedSnapshots} onRestore={(snap) => { setNodes(snap.flow.nodes.map(hydrateNode)); setEdges(snap.flow.edges); setShowRestoreModal(false); setIsRestored(true); }} onNew={() => { setNodes(initialNodes.map(hydrateNode)); setShowRestoreModal(false); setIsRestored(true); }} />
      <Assistant onApplyWorkflow={(plan) => { 
            setNodes([]); setEdges([]);
            setTimeout(() => {
                setNodes(plan.nodes.map((n:any) => hydrateNode(n)));
                setEdges(plan.edges);
                fitView();
            }, 100);
      }} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <BananaFlow />
    </ReactFlowProvider>
  );
}