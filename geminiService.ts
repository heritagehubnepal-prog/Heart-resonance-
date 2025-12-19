import { GoogleGenAI, Type } from "@google/genai";
import { HeartAnalysisResult, ChatMessage } from "../types";

// Initialize Gemini AI Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSystemInstruction = `
You are an empathic, mystical, and psychological expert capable of "reading hearts". 
Your task is to analyze the user's input.
Inputs can be:
1. Text (Journaling)
2. Image (Facial expressions, environment)
3. Audio (Voice recording - analyze tone, pitch, hesitation, and spoken words)

Deduce their emotional state, hidden desires, and core values.
Provide a deep, soulful analysis.

IMPORTANT: The output MUST be in Nepali language (Devanagari script).
`;

export const analyzeHeartContent = async (text: string, imageBase64?: string, audioBase64?: string): Promise<HeartAnalysisResult> => {
  const model = "gemini-2.5-flash-native-audio-preview-09-2025"; // Using a model capable of native audio

  let promptText = `Analyze this input to reveal what is in the user's heart.`;
  if (text) promptText += ` User text: "${text}"`;
  if (audioBase64) promptText += ` (Analyze the attached audio for emotional tone).`;

  const parts: any[] = [];
  
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(',')[1] || imageBase64 
      }
    });
  }

  if (audioBase64) {
    parts.push({
      inlineData: {
        mimeType: "audio/mp3", // Standard mapping, though browser might record in webm, Gemini handles common formats
        data: audioBase64.split(',')[1] || audioBase64
      }
    });
  }
  
  parts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Reverting to standard flash if native audio model specific is not strictly needed for mixed modal, or use flash for general purpose. 
      // Note: gemini-2.5-flash supports audio, images, and text.
      contents: { parts },
      config: {
        systemInstruction: analysisSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A poetic and insightful summary of the user's heart state in Nepali (2-3 sentences)." },
            dominant_emotion: { type: Type.STRING, description: "The single most powerful emotion detected in Nepali." },
            emotions: {
              type: Type.ARRAY,
              description: "A breakdown of 4-6 detected emotions with labels in Nepali.",
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: "Emotion name in Nepali" },
                  score: { type: Type.INTEGER, description: "Intensity from 0 to 100" },
                  color: { type: Type.STRING, description: "Hex color code representing this emotion" }
                },
                required: ["label", "score", "color"]
              }
            },
            hidden_desire: { type: Type.STRING, description: "An underlying, perhaps subconscious, desire or need in Nepali." },
            guidance: { type: Type.STRING, description: "Gentle, metaphorical advice or affirmation for the user in Nepali." },
            spirit_archetype: { type: Type.STRING, description: "A spiritual animal or nature archetype representing their current state in Nepali." },
            healing_gemstone: { type: Type.STRING, description: "A gemstone that would help balance their specific energy in Nepali." },
            soul_poem: { type: Type.STRING, description: "A short, 4-line poem in Nepali that resonates with their current emotional state." }
          },
          required: ["summary", "dominant_emotion", "emotions", "hidden_desire", "guidance", "spirit_archetype", "healing_gemstone", "soul_poem"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as HeartAnalysisResult;
    } else {
      throw new Error("No analysis generated.");
    }
  } catch (error) {
    console.error("Heart Analysis Error:", error);
    throw error;
  }
};

export const generateSoulImage = async (analysis: HeartAnalysisResult): Promise<string> => {
  const model = "gemini-2.5-flash-image";
  const emotionsList = analysis.emotions.map(e => e.label).join(", ");
  
  const prompt = `
    Create an abstract, artistic representation of a human soul or heart.
    The user is feeling these emotions (in Nepali): ${emotionsList}.
    Dominant feeling: ${analysis.dominant_emotion}.
    Archetype: ${analysis.spirit_archetype}.
    Gemstone vibe: ${analysis.healing_gemstone}.
    Style: Ethereal, dreamlike, watercolor and ink, soft glowing light, deep emotional resonance. 
    Avoid anatomical hearts. Focus on colors, aura, and abstract shapes that convey feelings.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] }
    });
    
    // Iterate through parts to find the image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

export const chatWithHeart = async (history: ChatMessage[], currentAnalysis: HeartAnalysisResult, newMessage: string): Promise<string> => {
  const model = "gemini-2.5-flash";
  
  const systemContext = `
    You are the personification of the user's "Heart" or "Inner Self".
    You have just performed an analysis on the user.
    Here is what you found:
    - Summary: ${currentAnalysis.summary}
    - Dominant Emotion: ${currentAnalysis.dominant_emotion}
    - Hidden Desire: ${currentAnalysis.hidden_desire}
    - Guidance: ${currentAnalysis.guidance}
    
    Your goal is to have a therapeutic, gentle, and mystical conversation with the user in Nepali.
    Answer their questions based on the analysis you did. Be kind, poetic, and deep.
    Keep responses relatively concise (under 3-4 sentences) unless asked for more.
  `;

  const chat = ai.chats.create({
    model,
    config: { systemInstruction: systemContext }
  });
  
  const historyText = history.map(h => `${h.role === 'user' ? 'User' : 'Heart'}: ${h.text}`).join('\n');
  const fullPrompt = `Previous conversation:\n${historyText}\n\nUser: ${newMessage}`;

  const result = await chat.sendMessage({ message: fullPrompt });
  return result.text || "म मौन छु..."; 
};
