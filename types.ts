import type { Node, Edge } from '@xyflow/react';

declare global {
  interface Window {
    Pose: any;
  }
}

export enum NodeType {
  PROMPT = 'prompt',
  GENERATE = 'generate',
  EDIT = 'edit',
  ENHANCE = 'enhance',
  INPAINT = 'inpaint',
  VIDEO = 'video',
  IMAGE_TO_TEXT = 'image_to_text',
  OUTPAINT = 'outpaint',
  COMPRESSION = 'compression',
  DRAW = 'draw',
  CHARACTER_EDIT = 'character_edit',
  POSE = 'pose',
  ECOMMERCE = 'ecommerce',
  NOTE = 'note',
  COMPARE = 'compare',
}

export interface CharacterAttributes {
  style?: string;
  head?: string;
  eyes?: string;
  nose?: string;
  mouth?: string;
  expression?: string;
  clothing?: string;
  upper_body?: string;
  lower_body?: string;
  shoes?: string;
  held_item?: string;
  view?: string;
  feature_points?: { label: string, x: number, y: number }[];
  customEdits?: CustomEditPoint[];
}

export interface CustomEditPoint {
    id: string;
    x: number;
    y: number;
    prompt: string;
    label?: string;
    referenceImages?: string[];
}

export interface PoseLandmark {
    id: string;
    label?: string;
    x: number; // 0-100 percentage
    y: number; // 0-100 percentage
    color?: string;
}

export interface NodeData {
  // Allow arbitrary properties for ReactFlow compatibility
  [key: string]: any;

  text?: string;
  style?: string; // Added for PromptNode
  image?: string;
  mask?: string;
  sketch?: string; // For DrawNode composite
  strokeLayer?: string; // For DrawNode strokes only
  uploadedImage?: string;
  referenceImages?: string[];
  isLoading?: boolean;
  error?: string;
  gallery?: string[];
  history?: string[]; // For Undo/Redo
  
  // Settings
  aspectRatio?: string;
  direction?: string; // For Outpaint
  
  // Video
  video?: string;
  videoType?: 'veo' | 'sequence';
  spriteSheets?: string[];
  spriteSheet?: string; // Legacy support
  frameCount?: number;
  frameOffsets?: Record<number, {x: number, y: number}>; // For manual frame alignment
  
  // Character
  characterAttributes?: CharacterAttributes;
  isAnalyzing?: boolean;
  
  // Pose
  poseLandmarks?: PoseLandmark[];
  poseSkeletonImage?: string; // The generated black/colored stickman image
  poseDescription?: string; // Chinese description of the action
  poseReferenceImage?: string; // Secondary image for extracting action description
  poseControlMode?: 'skeleton' | 'text'; // Mode selector
  
  // Ecommerce
  ecommerceMode?: 'model' | 'extract' | 'try_on' | 'ref_extract';
  ecommerceAttributes?: {
      gender?: string;
      ethnicity?: string;
      age?: string;
      setting?: string;
      clothingStyle?: string;
  };
  ecommerceGarmentImage?: string; // Specific input for garment
  
  // Compression
  originalSize?: string;
  compressedSize?: string;
  compressionFormat?: 'image/webp' | 'image/jpeg' | 'image/png';
  compressionQuality?: number;
  compressionScale?: number;

  // Handlers
  onTextChange?: (text: string) => void;
  onStyleChange?: (style: string) => void;
  onSelectImage?: (image: string) => void;
  setMask?: (mask: string) => void;
  setSketch?: (sketch: string) => void;
  setStrokeLayer?: (img: string) => void;
  setUploadedImage?: (image: string | undefined) => void;
  addReferenceImage?: (image: string) => void;
  removeReferenceImage?: (index: number) => void;
  setAspectRatio?: (ratio: string) => void;
  setDirection?: (direction: string) => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onRun?: (payload?: any) => void;
  
  // Video Handlers
  setVideoType?: (type: 'veo' | 'sequence') => void;
  setFrameCount?: (count: number) => void;
  setFrameOffsets?: (offsets: Record<number, {x: number, y: number}>) => void;

  // Character Handlers
  setCharacterAttributes?: (attrs: CharacterAttributes) => void;
  
  // Pose Handlers
  setPoseLandmarks?: (landmarks: PoseLandmark[]) => void;
  setPoseDescription?: (desc: string) => void;
  setPoseReferenceImage?: (img: string | undefined) => void;
  setPoseControlMode?: (mode: 'skeleton' | 'text') => void;
  
  // Ecommerce Handlers
  setEcommerceMode?: (mode: 'model' | 'extract' | 'try_on' | 'ref_extract') => void;
  setEcommerceAttributes?: (attrs: any) => void;
  setEcommerceGarmentImage?: (img: string | undefined) => void;
  
  // Compression Handlers
  setCompressionFormat?: (format: 'image/webp' | 'image/jpeg' | 'image/png') => void;
  setCompressionQuality?: (quality: number) => void;
  setCompressionScale?: (scale: number) => void;
  
  // Generic
  onApplyChange?: () => void;
  onUndoChange?: () => void;
  disabled?: boolean;
  onToggleDisabled?: () => void;
}

export type AppNode = Node<NodeData>;
export type AppEdge = Edge;