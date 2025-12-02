import React, { useState, useRef, useEffect } from 'react';
import { NodeWrapper } from './NodeWrapper';
import { AppNode } from '../../types';
import { MessageSquare, Palette, Sparkles } from 'lucide-react';
import { NodeProps } from '@xyflow/react';

const SUGGESTIONS = [
  "masterpiece", "best quality", "ultra detailed", "8k", "4k", "highres", "hdr",
  "cyberpunk", "steampunk", "anime", "photorealistic", "oil painting", "watercolor", "sketch",
  "digital art", "concept art", "illustration", "3d render", "unreal engine 5", "octane render",
  "cinematic lighting", "volumetric lighting", "studio lighting", "natural light", "soft light",
  "rim light", "god rays", "wide angle", "telephoto", "macro", "bokeh", "depth of field",
  "vibrant", "pastel", "monochrome", "neon", "dark fantasy", "sci-fi", "fantasy",
  "portrait", "landscape", "full body", "close up", "dynamic pose", "studio ghibli", "pixar",
  "highly detailed", "sharp focus", "intricate", "elegant", "smooth", "artstation", "trending on artstation",
  "vector art", "flat design", "isometric", "low poly", "pixel art"
].sort();

const STYLES = [
  { label: '赛博朋克 (Cyberpunk)', value: 'cyberpunk style, neon lights, futuristic, high contrast' },
  { label: '吉卜力 (Ghibli)', value: 'studio ghibli style, anime, vibrant colors, detailed background' },
  { label: '水彩 (Watercolor)', value: 'watercolor painting, soft blending, artistic, ethereal' },
  { label: '油画 (Oil Painting)', value: 'oil painting, thick brushstrokes, texture, classical art' },
  { label: '写实 (Photorealistic)', value: 'photorealistic, 8k, highly detailed, sharp focus' },
  { label: '素描 (Sketch)', value: 'pencil sketch, monochrome, rough lines, graphite' },
  { label: '3D渲染 (3D Render)', value: '3d render, blender, octane render, volumetric lighting' },
  { label: '像素 (Pixel Art)', value: 'pixel art, 16-bit, retro game style' },
];

export const PromptNode: React.FC<NodeProps<AppNode>> = ({ data, selected }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Use local state for the input value to handle IME (Chinese input) correctly
  const [localText, setLocalText] = useState(data.text || '');
  const isComposingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local text with prop text when prop changes (e.g. undo/redo), but not while typing
  useEffect(() => {
    if (data.text !== undefined && data.text !== localText) {
       // Only sync if the focused element is NOT this textarea, OR if the length difference is significant (paste/undo)
       // This prevents cursor jumping if parent updates are slightly delayed
       if (document.activeElement !== textareaRef.current) {
           setLocalText(data.text);
       }
    }
  }, [data.text]);

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const styleVal = e.target.value;
    
    // Logic to append style
    let newText = localText;
    if (styleVal && localText && !localText.includes(styleVal)) {
        newText = `${localText}, ${styleVal}`;
    } else if (styleVal && !localText) {
        newText = styleVal;
    }
    
    setLocalText(newText);
    if (data.onTextChange) {
        data.onTextChange(newText);
        data.onStyleChange?.(styleVal);
    }
  };

  const getWordAtCursor = (text: string, cursorIndex: number) => {
      let start = cursorIndex;
      // Walk backwards to find word boundary
      while (start > 0 && /[\w-]/.test(text[start - 1])) {
          start--;
      }
      const word = text.slice(start, cursorIndex);
      return { word, start };
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      setLocalText(newVal);

      // Only propagate to parent if NOT composing (IME)
      if (!isComposingRef.current) {
          data.onTextChange?.(newVal);
      }

      // Autocomplete logic
      const cursorIndex = e.target.selectionStart;
      const { word } = getWordAtCursor(newVal, cursorIndex);

      if (word.length >= 2) {
          const matches = SUGGESTIONS.filter(s => 
              s.toLowerCase().startsWith(word.toLowerCase()) && s.toLowerCase() !== word.toLowerCase()
          ).slice(0, 6);
          
          if (matches.length > 0) {
              setSuggestions(matches);
              setSelectedIndex(0);
              return;
          }
      }
      setSuggestions([]);
  };
  
  const handleCompositionStart = () => {
      isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      isComposingRef.current = false;
      // Now safe to update parent
      data.onTextChange?.(e.currentTarget.value);
  };

  const applySuggestion = (suggestion: string) => {
      if (!textareaRef.current) return;
      const text = localText || '';
      const cursorIndex = textareaRef.current.selectionStart;
      const { word, start } = getWordAtCursor(text, cursorIndex);
      
      const before = text.slice(0, start);
      const after = text.slice(cursorIndex);
      const newText = `${before}${suggestion} ${after}`; // Add space after
      
      setLocalText(newText);
      data.onTextChange?.(newText);
      setSuggestions([]);
      
      // Restore focus and move cursor
      setTimeout(() => {
          if (textareaRef.current) {
              textareaRef.current.focus();
              const newCursorPos = start + suggestion.length + 1;
              textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
      }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Vital: Stop propagation so ReactFlow doesn't intercept keys (like Backspace deleting the node)
      e.stopPropagation();

      if (suggestions.length > 0) {
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex(prev => (prev + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              applySuggestion(suggestions[selectedIndex]);
          } else if (e.key === 'Escape') {
              e.preventDefault();
              setSuggestions([]);
          }
      }
  };

  return (
    <NodeWrapper 
      title="提示词输入" 
      selected={selected} 
      outputs={[{ id: 'text', label: '文本' }]}
      colorClass="border-purple-500"
      onDelete={data.onDelete}
      onCopy={data.onCopy}
      onCut={data.onCut}
      disabled={data.disabled}
      onToggleDisabled={data.onToggleDisabled}
    >
      <div className="flex flex-col gap-2 h-full relative min-w-[240px] min-h-[160px]">
        <div className="flex items-center justify-between gap-2 text-purple-400 mb-1 shrink-0">
            <div className="flex items-center gap-1">
                <MessageSquare size={14} />
                <span className="text-xs uppercase font-bold">Prompt</span>
            </div>
            <div className="flex items-center gap-1 relative group">
                 <Palette size={12} className="text-gray-400 group-hover:text-purple-400" />
                 <select 
                    className="bg-transparent text-[10px] text-gray-400 hover:text-purple-400 focus:outline-none cursor-pointer w-[80px] text-right appearance-none"
                    onChange={handleStyleChange}
                    value="" // Always reset to allow re-selecting same style to append
                 >
                    <option value="" disabled>添加风格...</option>
                    {STYLES.map(s => (
                        <option key={s.label} value={s.value} className="bg-neutral-800 text-gray-200">
                            {s.label}
                        </option>
                    ))}
                 </select>
            </div>
        </div>
        
        <div className="relative flex-1 flex min-h-0">
            <textarea
                ref={textareaRef}
                className="nodrag nopan nowheel w-full h-full bg-black/30 text-white text-sm p-3 rounded border border-white/10 focus:outline-none focus:border-purple-500 resize-none placeholder-gray-600 custom-scrollbar leading-relaxed"
                placeholder="在这里输入你的创意..."
                value={localText}
                onChange={handleChange}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onKeyDown={handleKeyDown}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onBlur={() => {
                    setTimeout(() => setSuggestions([]), 200);
                    // Ensure sync on blur to catch any edge cases
                    if (data.text !== localText) data.onTextChange?.(localText);
                }}
                disabled={data.disabled}
            />
             
            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
                <div className="absolute left-0 bottom-full mb-1 w-full max-h-[150px] overflow-y-auto bg-neutral-800 border border-purple-500/30 rounded-md shadow-2xl z-50 flex flex-col">
                    <div className="text-[9px] text-gray-500 px-2 py-1 bg-black/20 border-b border-white/5 flex items-center gap-1">
                        <Sparkles size={10} className="text-purple-400"/>
                        <span>自动补全 (Tab)</span>
                    </div>
                    {suggestions.map((s, i) => (
                        <button
                            key={s}
                            className={`text-left px-3 py-1.5 text-xs hover:bg-purple-900/30 transition-colors ${i === selectedIndex ? 'bg-purple-900/50 text-white' : 'text-gray-300'}`}
                            onClick={() => applySuggestion(s)}
                            onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
        
        <div className="text-[9px] text-gray-600 text-right px-1">
            {localText ? `${localText.length} chars` : '0 chars'}
        </div>
      </div>
    </NodeWrapper>
  );
};