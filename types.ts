export interface EmotionData {
  label: string;
  score: number; // 0-100
  color: string;
}

export interface HeartAnalysisResult {
  summary: string;
  dominant_emotion: string;
  emotions: EmotionData[];
  hidden_desire: string;
  guidance: string;
  spirit_archetype: string;
  healing_gemstone: string;
  soul_poem: string; // New: A poem generated for the user
}

export interface ImageGenerationResult {
  imageUrl: string;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}

export interface AnalysisInput {
  text: string;
  image?: string; // base64
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
