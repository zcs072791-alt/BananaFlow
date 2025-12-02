import { GoogleGenAI, Type } from "@google/genai";
import { NodeType, CharacterAttributes, PoseLandmark } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cleanBase64 = (data: string) => {
  if (data.includes(',')) {
    return data.split(',')[1];
  }
  return data;
};

const formatBase64Image = (data: string) => {
  if (data.startsWith('data:image')) {
    return data;
  }
  return `data:image/png;base64,${data}`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- GLOBAL RATE LIMITER FOR FREE TIER (Nano Banana) ---
let requestQueue = Promise.resolve();
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 10000; 

// Tracking for UI
let queueLength = 0;

export const getQueueStatus = () => ({
    queueLength,
    isWaiting: queueLength > 0
});

const scheduleGeminiRequest = <T>(operation: () => Promise<T>): Promise<T> => {
    queueLength++;
    const nextRequest = requestQueue.then(async () => {
        const now = Date.now();
        const timeSinceLast = now - lastRequestTime;
        if (timeSinceLast < MIN_REQUEST_GAP) {
            await sleep(MIN_REQUEST_GAP - timeSinceLast);
        }
        lastRequestTime = Date.now();
        try {
            return await retryOperation(operation);
        } finally {
            queueLength = Math.max(0, queueLength - 1);
        }
    });
    requestQueue = nextRequest.then(() => {}).catch(() => {
         if (queueLength > 0) queueLength--;
    });
    return nextRequest;
};

async function retryOperation<T>(operation: () => Promise<T>, retries = 10, baseDelay = 5000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isQuota = error.status === 429 || 
                    error.status === 503 || 
                    (error.message && (
                        error.message.includes('429') || 
                        error.message.includes('503') || 
                        error.message.includes('quota') || 
                        error.message.includes('exhausted') || 
                        error.message.includes('RESOURCE_EXHAUSTED') ||
                        error.message.includes('Overloaded') ||
                        error.message.includes('Too Many Requests')
                    ));
    
    if (isQuota) {
       if (retries > 0) {
           const waitTime = baseDelay + (Math.random() * 2000); 
           console.warn(`API Limit/Busy (${error.status}). Retrying in ${Math.round(waitTime/1000)}s... (${retries} attempts left)`);
           lastRequestTime = Date.now() + waitTime;
           await sleep(waitTime);
           return retryOperation(operation, retries - 1, baseDelay * 1.5); 
       }
       throw new Error("配额耗尽或服务繁忙 (Quota Exhausted). 可能是当天的免费额度已用完，请明天再试。");
    }
    throw error;
  }
}

// ... (Existing export functions: generateImage, sketchToImage, analyzeCharacter, identifyElementAtPoint, etc. KEEP THEM)

export const generateImage = async (prompt: string, referenceImages?: string[], aspectRatio: string = "1:1"): Promise<string> => {
  return scheduleGeminiRequest(async () => {
      const parts: any[] = [];
      if (referenceImages && referenceImages.length > 0) {
          referenceImages.forEach(img => {
              parts.push({
                  inlineData: { mimeType: 'image/png', data: cleanBase64(img) }
              });
          });
          parts.push({ text: `Reference the style, character, and composition from the images above STRICTLY. ${prompt}` });
      } else {
          parts.push({ text: prompt });
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { imageConfig: { aspectRatio: aspectRatio as any } }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return formatBase64Image(part.inlineData.data);
      }
      throw new Error("No image generated");
  });
};

export const sketchToImage = async (prompt: string, sketch: string): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        const parts: any[] = [];
        parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(sketch) } });
        const controlPrompt = `STRICT STRUCTURAL ADHERENCE REQUIRED. The attached image is a specific composition sketch. Preserve structure. Instruction: ${prompt}`;
        parts.push({ text: controlPrompt });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { imageConfig: { aspectRatio: '1:1' } }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return formatBase64Image(part.inlineData.data);
        }
        throw new Error("No image generated from sketch");
    });
};

export const analyzeCharacter = async (image: string): Promise<CharacterAttributes> => {
    return scheduleGeminiRequest(async () => {
        const fullPrompt = `
            Analyze the character in the image and break down their appearance.
            1. Identify the style, clothing, and facial features.
            2. Estimate the center coordinates (0-100 scale) for the "eyes", "nose", and "mouth".
            Return JSON with style, head, eyes, nose, mouth, expression, clothing, upper_body, lower_body, shoes, held_item, feature_points.
            IMPORTANT: All string values for descriptions (style, clothing, etc.) MUST be in Simplified Chinese (简体中文).
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: cleanBase64(image) } },
                    { text: fullPrompt }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        style: { type: Type.STRING },
                        head: { type: Type.STRING },
                        eyes: { type: Type.STRING },
                        nose: { type: Type.STRING },
                        mouth: { type: Type.STRING },
                        expression: { type: Type.STRING },
                        clothing: { type: Type.STRING },
                        upper_body: { type: Type.STRING },
                        lower_body: { type: Type.STRING },
                        shoes: { type: Type.STRING },
                        held_item: { type: Type.STRING },
                        feature_points: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING },
                                    x: { type: Type.NUMBER },
                                    y: { type: Type.NUMBER },
                                }
                            }
                        }
                    }
                }
            }
        });
        try { return JSON.parse(response.text || "{}"); } catch (e) { throw new Error("Failed to parse character analysis."); }
    });
};

export const identifyElementAtPoint = async (image: string, x: number, y: number): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        const markedImageBase64 = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error("Canvas failed")); return; }
                ctx.drawImage(img, 0, 0);
                const px = (x / 100) * canvas.width;
                const py = (y / 100) * canvas.height;
                const radius = Math.max(canvas.width, canvas.height) * 0.025;
                ctx.beginPath();
                ctx.arc(px, py, radius, 0, 2 * Math.PI);
                ctx.lineWidth = Math.max(3, radius * 0.2);
                ctx.strokeStyle = '#FF0000';
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(px, py, Math.max(2, radius * 0.2), 0, 2 * Math.PI);
                ctx.fillStyle = '#FF0000';
                ctx.fill();
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = formatBase64Image(image);
        });
        const prompt = `Identify the specific object/feature at the RED CIRCLE. Return ONLY the name in Simplified Chinese (简体中文). Do not include any other text.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: cleanBase64(markedImageBase64) } }, { text: prompt }] }
        });
        return response.text?.trim() || "未知元素";
    });
};

export const generateCharacterFromAttributes = async (originalImage: string, attributes: CharacterAttributes): Promise<string> => {
     return scheduleGeminiRequest(async () => {
        const parts: any[] = [];
        parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(originalImage) } });
        
        let customEditsInstruction = "";
        let imageIndexCounter = 1;
        if (attributes.customEdits && attributes.customEdits.length > 0) {
            customEditsInstruction = "\nIMPORTANT - SPECIFIC REGIONAL EDITS:\n";
            attributes.customEdits.forEach((edit, i) => {
                let refImageInstruction = "";
                if (edit.referenceImages && edit.referenceImages.length > 0) {
                    edit.referenceImages.forEach((refImg) => {
                        parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(refImg) } });
                        refImageInstruction += ` [Use Image #${imageIndexCounter} as visual reference]`;
                        imageIndexCounter++;
                    });
                }
                customEditsInstruction += `[${i+1}] At ${Math.round(edit.x)}%, ${Math.round(edit.y)}%: ${edit.prompt}${refImageInstruction}\n`;
            });
        }

        const description = `Character: ${attributes.style}, ${attributes.head}, ${attributes.clothing}. ${customEditsInstruction}`;
        let prompt = "";
        if (attributes.view) {
             prompt = `VIEW ROTATION. Override pose. Target View: ${attributes.view}. ${description}`;
        } else {
             prompt = `RECONSTRUCTION. Keep pose. ${description}`;
        }
        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { imageConfig: { aspectRatio: '1:1' } }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return formatBase64Image(part.inlineData.data);
        }
        throw new Error("No character image generated");
    });
};

// --- MEDIAPIPE POSE INTEGRATION ---

let poseEstimator: any = null;

const initPoseEstimator = async () => {
    if (poseEstimator) return poseEstimator;

    if (!window.Pose) {
         // Wait a bit if script is loading async
         await new Promise(resolve => setTimeout(resolve, 1500));
         if (!window.Pose) throw new Error("MediaPipe Pose library not loaded.");
    }

    const pose = new window.Pose({locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }});
    
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    poseEstimator = pose;
    return pose;
};

// Map MediaPipe landmarks to our application's node IDs
const mapMediaPipeLandmarks = (mpLandmarks: any[]): PoseLandmark[] => {
    const landmarks: PoseLandmark[] = [];
    const getPoint = (idx: number) => mpLandmarks[idx];

    // Helper to create point
    const add = (id: string, x: number, y: number) => {
        landmarks.push({ id, x: x * 100, y: y * 100 });
    };

    // Nose
    const nose = getPoint(0);
    if(nose) add('nose', nose.x, nose.y);

    // Shoulders
    const lShoulder = getPoint(11);
    const rShoulder = getPoint(12);
    if (lShoulder) add('left_shoulder', lShoulder.x, lShoulder.y);
    if (rShoulder) add('right_shoulder', rShoulder.x, rShoulder.y);

    // Calculated Neck (Midpoint of shoulders)
    if (lShoulder && rShoulder) {
        add('neck', (lShoulder.x + rShoulder.x) / 2, (lShoulder.y + rShoulder.y) / 2);
    }

    // Arms
    const lElbow = getPoint(13);
    const rElbow = getPoint(14);
    if (lElbow) add('left_elbow', lElbow.x, lElbow.y);
    if (rElbow) add('right_elbow', rElbow.x, rElbow.y);

    const lWrist = getPoint(15);
    const rWrist = getPoint(16);
    if (lWrist) add('left_wrist', lWrist.x, lWrist.y);
    if (rWrist) add('right_wrist', rWrist.x, rWrist.y);

    // Body/Legs
    const lHip = getPoint(23);
    const rHip = getPoint(24);
    if (lHip) add('left_hip', lHip.x, lHip.y);
    if (rHip) add('right_hip', rHip.x, rHip.y);

    const lKnee = getPoint(25);
    const rKnee = getPoint(26);
    if (lKnee) add('left_knee', lKnee.x, lKnee.y);
    if (rKnee) add('right_knee', rKnee.x, rKnee.y);

    const lAnkle = getPoint(27);
    const rAnkle = getPoint(28);
    if (lAnkle) add('left_ankle', lAnkle.x, lAnkle.y);
    if (rAnkle) add('right_ankle', rAnkle.x, rAnkle.y);

    return landmarks;
};

export const detectPose = async (image: string): Promise<PoseLandmark[]> => {
    // Replaced Gemini API with MediaPipe for better precision and speed
    const pose = await initPoseEstimator();
    
    return new Promise((resolve, reject) => {
        // One-off listener for results
        const onResults = (results: any) => {
             if (results.poseLandmarks) {
                 const mapped = mapMediaPipeLandmarks(results.poseLandmarks);
                 resolve(mapped);
             } else {
                 resolve([]);
             }
        };

        // There isn't a simple "once" method, so we overwrite onResults.
        // In a complex app with multiple pose nodes running simultaneously, 
        // this would need a more robust queue/event system, but for single-user interaction it is fine.
        pose.onResults(onResults);
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
            try {
                await pose.send({image: img});
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = (err) => reject(new Error("Failed to load image for pose detection"));
        img.src = image;
    });
};

export const describePose = async (image: string): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        // Optimized Prompt for Speed and Conciseness
        const prompt = `
            Analyze the character's pose in this image and return a CONCISE description in Simplified Chinese (简体中文).
            Focus on:
            1. Head (Tilt/Look)
            2. Hands (Gesture)
            3. Legs (Stance)
            4. Body (Lean)
            
            Keep it short and descriptive. Do not use lists. One or two sentences.
            Example: "人物侧身站立，头向左转，左手高举过头顶，右手自然下垂，双腿交叉。"
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: cleanBase64(image) } }, { text: prompt }] }
        });
        return response.text?.trim() || "";
    });
};

export const generateFromPose = async (originalImage: string | undefined, skeletonImage: string, prompt: string, aspectRatio: string = "1:1"): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        const parts: any[] = [];
        
        // 1. The Volumetric Mannequin Image (Structure)
        parts.push({ 
            inlineData: { mimeType: 'image/png', data: cleanBase64(skeletonImage) } 
        });

        // 2. The Original Character Reference (Style/Identity)
        if (originalImage) {
            parts.push({ 
                inlineData: { mimeType: 'image/png', data: cleanBase64(originalImage) } 
            });
        }

        const instruction = `
            ROLE: 3D Character Renderer.
            
            INPUTS:
            - Image #0: A 3D VOLUMETRIC MANNEQUIN COMPOSITION. 
              (Note: The cylinders represent limbs with volume. The spheres represent joints. The gradient lighting indicates depth.)
            ${originalImage ? '- Image #1: CHARACTER REFERENCE (Style, Identity).' : ''}
            - Prompt: "${prompt}"

            TASK:
            Render the character described/shown in Image #1 into the EXACT pose defined by the 3D Mannequin (Image #0).
            
            CHAIN OF THOUGHT:
            1. **Analyze Volume**: Treat Image #0 as a 3D depth map. The gradients on the cylinders indicate their roundness and orientation.
            2. **Identify Structure**: 
               - Blue = Torso/Core
               - Red/Pink = Arms
               - Green/Teal = Legs
            3. **Map Character**: Wrap the character's skin/clothing around these 3D volumes.
            4. **Perspective**: If a cylinder is foreshortened (short in 2D), the limb is pointing towards/away from camera. Respect this depth.
            
            NEGATIVE CONSTRAINTS:
            - Do NOT draw the colored cylinders or spheres in the final output. They are invisible guides.
            - Do NOT generate a stick figure.
            - Do NOT create a skeleton.
            - Generate a fully rendered, high-quality illustration.
        `;
        
        parts.push({ text: instruction });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { imageConfig: { aspectRatio: aspectRatio as any } }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return formatBase64Image(part.inlineData.data);
        }
        throw new Error("No image generated from pose");
    });
};

export const generatePoseFromText = async (originalImage: string, prompt: string, aspectRatio: string = "1:1"): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        const parts: any[] = [];
        // Original image as character reference
        parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(originalImage) } });
        
        const instruction = `
            TASK: CHARACTER ACTION GENERATION (TEXT DRIVEN).
            
            Image #0 is the CHARACTER REFERENCE (Style, Identity, Clothes).
            
            USER PROMPT (ACTION/POSE): ${prompt}
            
            INSTRUCTIONS:
            1. Generate a new image of the character from Image #0 performing the action described in the prompt.
            2. Maintain the character's identity (face, hair, outfit, art style) as closely as possible.
            3. DO NOT copy the pose or composition from Image #0. The pose must match the text prompt.
            4. High quality, detailed execution.
        `;
        parts.push({ text: instruction });
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { imageConfig: { aspectRatio: aspectRatio as any } }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return formatBase64Image(part.inlineData.data);
        }
        throw new Error("No image generated from text description");
    });
};

export const generateEcommerceImage = async (
    mode: 'model' | 'extract' | 'try_on' | 'ref_extract',
    images: { model?: string, garment?: string, original?: string },
    attributes?: any,
    prompt?: string
): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        const parts: any[] = [];
        let instruction = "";
        
        if (mode === 'model') {
            const ethnicity = attributes?.ethnicity || 'Universal';
            const gender = attributes?.gender || 'Female';
            const age = attributes?.age || 'Young Adult';
            const setting = attributes?.setting || 'Studio';
            const clothingStyle = attributes?.clothingStyle || 'Casual';

            instruction = `
                Generate a professional e-commerce fashion model photo.
                Subject: ${age} ${ethnicity} ${gender} Model.
                Attire Style: ${clothingStyle}.
                Setting: ${setting}. 
                Lighting: High-end professional studio lighting, 8k resolution, highly detailed skin texture.
                Pose: Neutral standing pose suitable for showcasing clothing.
                Style: Photorealistic, Commercial Photography.
                ${prompt ? `Additional details: ${prompt}` : ''}
            `;
            parts.push({ text: instruction });
        } else if (mode === 'extract') {
            if (!images.original) throw new Error("Original image required for extraction");
            parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(images.original) } });
            instruction = `
                TASK: Clothing Extraction / Ghost Mannequin Effect.
                Input Image: A photo of a person wearing clothes.
                Action: Isolate and extract ONLY the main clothing item(s). 
                Remove the model's body, skin, head, hands, and legs.
                Remove the background.
                Place the clothing on a pure white background.
                Ensure the clothing looks 3D and filled out (as if worn by an invisible ghost).
                High fidelity, keep textures and lighting.
            `;
            parts.push({ text: instruction });
        } else if (mode === 'ref_extract') {
             const source = images.garment || images.original;
             if (!source) throw new Error("Source image required for reference extraction");
             parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(source) } });
             instruction = `
                TASK: Reference Image Normalization & Extraction.
                Input: A raw photo of a clothing item (flat lay, hanger, or product shot).
                
                Action:
                1. Crop and isolate the main garment from the background/surroundings.
                2. Normalize the perspective to be a straight-on, flat view if possible.
                3. Place on a clean, pure white background.
                4. Enhance the lighting to be even and professional.
                5. Output HIGH FIDELITY texture details. This will be used as a reference for virtual try-on.
            `;
            parts.push({ text: instruction });
        } else if (mode === 'try_on') {
            if (!images.model) throw new Error("Model image required for try-on");
            if (!images.garment) throw new Error("Garment image required for try-on");
            
            parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(images.model) } });
            parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(images.garment) } });
            
            instruction = `
                TASK: Virtual Try-On.
                Image #0: Target Model.
                Image #1: Garment Reference.
                
                Action: Generate a photorealistic image of the Model (from Image #0) wearing the Garment (from Image #1).
                
                Constraints:
                - Preserve the Model's identity, face, body shape, and pose exactly as seen in Image #0.
                - Preserve the Garment's texture, pattern, color, and logo exactly as seen in Image #1.
                - Adapt the garment to fit the model's body naturally (folds, lighting, shadows).
                - Retain the background from Image #0 if possible, or use a clean studio background.
                - High Quality, 8k, Photorealistic.
            `;
            parts.push({ text: instruction });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { imageConfig: { aspectRatio: '3:4' } } // Portrait for fashion usually
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return formatBase64Image(part.inlineData.data);
        }
        throw new Error("No ecommerce image generated");
    });
};

export const generateSpriteSheet = async (prompt: string, referenceImage?: string, aspectRatio: string = "3:2", frameCount: number = 12): Promise<string[]> => {
  const framesPerSheet = 12;
  const gridRows = 3; 
  const modelRatio = "4:3";
  const sheetsCount = Math.ceil(frameCount / framesPerSheet);
  const results: string[] = [];
  for (let i = 0; i < sheetsCount; i++) {
      const seqPrompt = `STRICT INSTRUCTION: Create a "Sprite Sheet" containing EXACTLY ${framesPerSheet} frames. Layout: 4 columns x ${gridRows} rows grid. Subject: ${prompt}. Green background.`;
      try {
          const sheet = await scheduleGeminiRequest(async () => {
              const parts: any[] = [];
              if (referenceImage) parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64(referenceImage) } });
              parts.push({ text: seqPrompt });
              const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts },
                config: { imageConfig: { aspectRatio: modelRatio as any } }
              });
              for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) return formatBase64Image(part.inlineData.data);
              }
              throw new Error("No sprite sheet generated");
          });
          results.push(sheet);
      } catch (e) {
          if (results.length > 0) break;
          throw e;
      }
  }
  return results;
};

export const editImage = async (image: string, prompt: string): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: cleanBase64(image) } }, { text: `Edit instruction: ${prompt}. Keep the composition similar.` }] }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return formatBase64Image(part.inlineData.data);
        }
        throw new Error("No edited image returned");
    });
};

export const enhanceImage = async (image: string): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: cleanBase64(image) } }, { text: "Enhance this image quality. Make it sharper, more detailed, and higher resolution." }] }
        });
         for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return formatBase64Image(part.inlineData.data);
        }
        throw new Error("No enhanced image returned");
    });
};

export const inpaintImage = async (image: string, mask: string, prompt: string): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: cleanBase64(image) } }, { inlineData: { mimeType: 'image/png', data: cleanBase64(mask) } }, { text: `Inpaint the masked area (white) with: ${prompt}. Blending seamlessly.` }] }
        });
         for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return formatBase64Image(part.inlineData.data);
        }
        throw new Error("No inpainted image returned");
    });
};

export const extendImage = async (image: string, prompt: string, direction: string, aspectRatio: string): Promise<string> => {
     return scheduleGeminiRequest(async () => {
        const dirMap: Record<string, string> = { 'up': 'Extend upwards.', 'down': 'Extend downwards.', 'left': 'Extend left.', 'right': 'Extend right.', 'zoom-out': 'Zoom out all directions.' };
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: cleanBase64(image) } }, { text: `${dirMap[direction] || 'Extend.'} ${prompt}. Seamless integration.` }] },
            config: { imageConfig: { aspectRatio: aspectRatio as any } }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return formatBase64Image(part.inlineData.data);
        }
        throw new Error("No extended image returned");
    });
};

export const generateVideo = async (prompt: string, image?: string, aspectRatio: string = '16:9'): Promise<string> => {
    let operation;
    const cleanPrompt = prompt || "Animate this";
    if (image) {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: cleanPrompt,
            image: { imageBytes: cleanBase64(image), mimeType: 'image/png' },
            config: { numberOfVideos: 1, aspectRatio: aspectRatio as any, resolution: '720p' }
        });
    } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: cleanPrompt,
            config: { numberOfVideos: 1, aspectRatio: aspectRatio as any, resolution: '720p' }
        });
    }
    while (!operation.done) {
        await sleep(5000);
        operation = await ai.operations.getVideosOperation({operation: operation});
    }
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video generation failed");
    const vidResponse = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    const vidBlob = await vidResponse.blob();
    return URL.createObjectURL(vidBlob);
};

export const imageToText = async (image: string): Promise<string> => {
    return scheduleGeminiRequest(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: cleanBase64(image) } }, { text: "Describe this image in detail in Simplified Chinese. Focus on visual elements, style, lighting, and composition for use as an image generation prompt." }] }
        });
        return response.text || "Could not describe image.";
    });
};

export interface WorkflowPlan { description: string; nodes: any[]; edges: any[]; shouldClearCanvas?: boolean; }

export const planWorkflow = async (userInput: string, attachedImage?: string): Promise<WorkflowPlan> => {
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ text: `You are an AI assistant for 'BananaFlow'... Return JSON plan... User: "${userInput}". Ensure the "description" field is in Simplified Chinese.` }],
        config: { responseMimeType: 'application/json' }
    });
    try { return JSON.parse(response.text || "{}"); } catch (e) { throw new Error("Failed to parse assistant plan."); }
};

export const createSourceGenWorkflow = (image?: string): WorkflowPlan => {
    return {
        description: "源文件逆向生成工作流",
        shouldClearCanvas: true,
        nodes: [
            { id: 'src_root', type: image ? NodeType.GENERATE : NodeType.PROMPT, position: { x: 0, y: 200 }, data: { text: image ? undefined : "Describe your subject", uploadedImage: image } },
            { id: 'src_enhance', type: NodeType.ENHANCE, position: { x: 400, y: 200 }, data: {} },
            { id: 'lyr_main', type: NodeType.EDIT, position: { x: 800, y: 0 }, data: { text: "Keep only main subject, remove background, transparent bg" } },
            { id: 'lyr_bg', type: NodeType.EDIT, position: { x: 800, y: 200 }, data: { text: "Remove subject, clean background plate" } },
            { id: 'lyr_line', type: NodeType.EDIT, position: { x: 800, y: 400 }, data: { text: "Black and white line art, vector outlines" } },
            { id: 'lyr_color', type: NodeType.EDIT, position: { x: 800, y: 600 }, data: { text: "Flat color blocks, posterize, no details" } },
             { id: 'p_main', type: NodeType.PROMPT, position: { x: 600, y: -50 }, data: { text: "Keep only main subject, remove background, transparent bg" } },
             { id: 'p_bg', type: NodeType.PROMPT, position: { x: 600, y: 150 }, data: { text: "Remove subject, clean background plate" } },
             { id: 'p_line', type: NodeType.PROMPT, position: { x: 600, y: 350 }, data: { text: "Black and white line art, vector outlines" } },
             { id: 'p_color', type: NodeType.PROMPT, position: { x: 600, y: 550 }, data: { text: "Flat color blocks, posterize, no details" } },
        ],
        edges: [
             { id: 'e1', source: 'src_root', target: 'src_enhance', sourceHandle: image ? 'image' : 'text', targetHandle: 'image' },
             { id: 'e2', source: 'src_enhance', target: 'lyr_main', sourceHandle: 'image', targetHandle: 'image' },
             { id: 'e3', source: 'src_enhance', target: 'lyr_bg', sourceHandle: 'image', targetHandle: 'image' },
             { id: 'e4', source: 'src_enhance', target: 'lyr_line', sourceHandle: 'image', targetHandle: 'image' },
             { id: 'e5', source: 'src_enhance', target: 'lyr_color', sourceHandle: 'image', targetHandle: 'image' },
             { id: 'ep1', source: 'p_main', target: 'lyr_main', sourceHandle: 'text', targetHandle: 'prompt' },
             { id: 'ep2', source: 'p_bg', target: 'lyr_bg', sourceHandle: 'text', targetHandle: 'prompt' },
             { id: 'ep3', source: 'p_line', target: 'lyr_line', sourceHandle: 'text', targetHandle: 'prompt' },
             { id: 'ep4', source: 'p_color', target: 'lyr_color', sourceHandle: 'text', targetHandle: 'prompt' },
        ]
    };
};

export const createVectorSepWorkflow = (image?: string): WorkflowPlan => {
      return {
        description: "矢量源文件拆分",
        shouldClearCanvas: true,
        nodes: [
             { id: 'v_root', type: image ? NodeType.GENERATE : NodeType.PROMPT, position: { x: 0, y: 200 }, data: { uploadedImage: image } },
             { id: 'v_enhance', type: NodeType.ENHANCE, position: { x: 350, y: 200 }, data: {} },
             { id: 'v_vector', type: NodeType.EDIT, position: { x: 700, y: 200 }, data: { text: "Vector art style, flat colors, sharp edges" } },
             { id: 'p_vector', type: NodeType.PROMPT, position: { x: 500, y: 50 }, data: { text: "Vector art style, flat colors, sharp edges" } },
             { id: 'l_outline', type: NodeType.EDIT, position: { x: 1100, y: 0 }, data: {} },
             { id: 'p_outline', type: NodeType.PROMPT, position: { x: 900, y: 0 }, data: { text: "Black outlines only, white background" } },
             { id: 'l_primary', type: NodeType.EDIT, position: { x: 1100, y: 200 }, data: {} },
             { id: 'p_primary', type: NodeType.PROMPT, position: { x: 900, y: 200 }, data: { text: "Primary colors only" } },
             { id: 'l_secondary', type: NodeType.EDIT, position: { x: 1100, y: 400 }, data: {} },
             { id: 'p_secondary', type: NodeType.PROMPT, position: { x: 900, y: 400 }, data: { text: "Secondary shading colors" } },
        ],
        edges: [
             { id: 'e_v1', source: 'v_root', target: 'v_enhance', targetHandle: 'image' },
             { id: 'e_v2', source: 'v_enhance', target: 'v_vector', targetHandle: 'image' },
             { id: 'e_p_v', source: 'p_vector', target: 'v_vector', targetHandle: 'prompt' },
             { id: 'e_l1', source: 'v_vector', target: 'l_outline', targetHandle: 'image' },
             { id: 'e_p1', source: 'p_outline', target: 'l_outline', targetHandle: 'prompt' },
             { id: 'e_l2', source: 'v_vector', target: 'l_primary', targetHandle: 'image' },
             { id: 'e_p2', source: 'p_primary', target: 'l_primary', targetHandle: 'prompt' },
             { id: 'e_l3', source: 'v_vector', target: 'l_secondary', targetHandle: 'image' },
             { id: 'e_p3', source: 'p_secondary', target: 'l_secondary', targetHandle: 'prompt' },
        ]
      };
};