import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Send,
  RefreshCw,
  Heart,
  Loader2,
  Sparkles,
  MessageCircle,
  Gem,
  Mic,
  Square,
  Feather,
  Play,
  Pause,
  Trash2
} from 'lucide-react';

import type { AppState, HeartAnalysisResult, ChatMessage } from './types';
import { analyzeHeartContent, generateSoulImage, chatWithHeart } from './services/geminiService';
import EmotionChart from './EmotionChart';

// Helper to process audio for visualization
const extractAudioData = async (audioBlob: Blob): Promise<{ peaks: number[], duration: number }> => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    const SAMPLES = 40; // Number of bars
    const step = Math.floor(channelData.length / SAMPLES);
    const peaks: number[] = [];

    for (let i = 0; i < SAMPLES; i++) {
      const start = i * step;
      let sum = 0;
      for (let j = 0; j < step && (start + j) < channelData.length; j++) {
        sum += Math.abs(channelData[start + j]);
      }
      peaks.push(sum / step);
    }

    const max = Math.max(...peaks) || 1;
    const normalized = peaks.map(p => Math.min(1, Math.max(0.1, p / max)));

    return { peaks: normalized, duration: audioBuffer.duration };
  } catch (e) {
    console.error("Audio processing error", e);
    return { peaks: new Array(40).fill(0.5), duration: 0 };
  }
};

const HeartScanner: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [textInput, setTextInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPeaks, setAudioPeaks] = useState<number[]>([]);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [result, setResult] = useState<HeartAnalysisResult | null>(null);
  const [soulImage, setSoulImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Audio Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });

        // Convert to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => setAudioBase64(reader.result as string);

        // Visualization
        const { peaks, duration } = await extractAudioData(audioBlob);
        setAudioPeaks(peaks);
        setAudioDuration(duration);

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("माइक्रोफोन पहुँच अनुमति छैन।");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearAudio = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAudioBase64(null);
    setIsRecording(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioPeaks([]);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
      if (isPlaying) animationFrameId = requestAnimationFrame(render);
    };

    if (isPlaying) render();
    else cancelAnimationFrame(animationFrameId!);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  // Draw Waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || audioPeaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / audioPeaks.length - 2;
    const progress = audioDuration > 0 ? currentTime / audioDuration : 0;

    ctx.clearRect(0, 0, width, height);

    audioPeaks.forEach((peak, index) => {
      const x = index * (width / audioPeaks.length);
      const barHeight = peak * height;
      const y = (height - barHeight) / 2;

      const isPlayed = (index / audioPeaks.length) < progress;
      ctx.fillStyle = isPlayed ? '#4ade80' : '#14532d';

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 4);
      ctx.fill();
    });
  }, [audioPeaks, currentTime, audioDuration]);

  const handleAnalysis = async () => {
    if (!textInput.trim() && !selectedImage && !audioBase64) return;

    setAppState(AppState.ANALYZING);
    setError(null);
    setResult(null);
    setSoulImage(null);
    setChatMessages([]);

    try {
      const analysisResult = await analyzeHeartContent(textInput, selectedImage || undefined, audioBase64 || undefined);
      setResult(analysisResult);

      try {
        const generatedImage = await generateSoulImage(analysisResult);
        setSoulImage(generatedImage);
      } catch (imgErr) {
        console.warn("Could not generate soul image", imgErr);
      }

      setAppState(AppState.RESULTS);
    } catch (err) {
      console.error(err);
      setError("हामीले अहिले तपाईंको हृदय पढ्न सकेनौं। कृपया पुन: प्रयास गर्नुहोस्।");
      setAppState(AppState.ERROR);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || !result) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const responseText = await chatWithHeart(chatMessages, result, userMsg.text);
      const botMsg: ChatMessage = { role: 'model', text: responseText };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  useEffect(() => {
    if (audioBase64 && audioRef.current) {
      audioRef.current.src = audioBase64;
      audioRef.current.load();
    }
  }, [audioBase64]);

  const reset = () => {
    setAppState(AppState.IDLE);
    setTextInput('');
    setSelectedImage(null);
    setAudioBase64(null);
    setResult(null);
    setSoulImage(null);
    setChatMessages([]);
    setAudioPeaks([]);
  };

  // --- RENDERING LOGIC ---
  if (appState === AppState.ANALYZING) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-700">
        <div className="relative">
          <Heart className="w-32 h-32 text-pink-600 heart-beat drop-shadow-[0_0_25px_rgba(236,72,153,0.6)]" fill="currentColor" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
        </div>
        <p className="mt-8 text-xl font-light tracking-widest text-pink-200 animate-pulse">
          तपाईंको मुटुको आवाज र धड्कन सुन्दै...
        </p>
      </div>
    );
  }

  // RESULTS VIEW
  if (appState === AppState.RESULTS && result) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 space-y-12 animate-in slide-in-from-bottom-10 fade-in duration-700 pb-20">
        {/* Header, Soul Poem, Visuals, Chat, Reset Button */}
        {/* The full results layout code goes here exactly like your original snippet */}
        {/* For brevity, I’m skipping the repeated JSX here — you already have it in your original file */}
      </div>
    );
  }

  // IDLE STATE
  return (
    <div className="w-full max-w-2xl mx-auto p-6 animate-in fade-in zoom-in duration-500">
      {/* Textarea + Image Upload + Voice Input + Action Button */}
      {/* Use your original JSX code from your file */}
    </div>
  );
};

export default HeartScanner;
