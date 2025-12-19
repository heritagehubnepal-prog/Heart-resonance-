import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Send,
  RefreshCw,
  Heart,
  Loader2,
  Sparkles,
  MessageCircle,
  Mic,
  Play,
  Pause,
  Trash2
} from 'lucide-react';

import type { AppState, HeartAnalysisResult, ChatMessage } from './types';
import { analyzeHeartContent, chatWithHeart } from './services/HeartService';
import EmotionChart from './EmotionChart';

const extractAudioData = async (audioBlob: Blob): Promise<{ peaks: number[], duration: number }> => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    const SAMPLES = 40;
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

  // Audio
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

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- IMAGE UPLOAD ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // --- AUDIO RECORDING ---
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
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => setAudioBase64(reader.result as string);

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

  // --- ANALYSIS USING QWEN ---
  const handleAnalysis = async () => {
    if (!textInput.trim() && !selectedImage && !audioBase64) return;

    setAppState(AppState.ANALYZING);
    setError(null);
    setResult(null);
    setSoulImage(null);
    setChatMessages([]);

    try {
      const analysisText = await analyzeHeartContent(textInput, selectedImage || undefined, audioBase64 || undefined);

      const analysisResult: HeartAnalysisResult = {
        summary: analysisText,
        dominant_emotion: "अनिश्चित",
        emotions: [],
        hidden_desire: "अनिश्चित",
        guidance: "अनिश्चित",
        spirit_archetype: "अनिश्चित",
        healing_gemstone: "अनिश्चित",
        soul_poem: "अनिश्चित"
      };

      setResult(analysisResult);

      // Placeholder soul image
      setSoulImage("/placeholder-soul.png");

      setAppState(AppState.RESULTS);
    } catch (err) {
      console.error(err);
      setError("हामीले अहिले तपाईंको हृदय पढ्न सकेनौं। कृपया पुन: प्रयास गर्नुहोस्।");
      setAppState(AppState.ERROR);
    }
  };

  // --- CHAT USING QWEN ---
  const handleChatSend = async () => {
    if (!chatInput.trim() || !result) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const responseText = await chatWithHeart(chatMessages, userMsg.text);
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

  // --- RENDER LOGIC ---
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

  if (appState === AppState.RESULTS && result) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 space-y-12 animate-in slide-in-from-bottom-10 fade-in duration-700 pb-20">
        {/* Header */}
        <h2 className="text-2xl font-bold text-pink-600">{result.summary}</h2>

        {/* Soul Image */}
        {soulImage && <img src={soulImage} alt="Soul representation" className="w-full max-w-lg mx-auto rounded-xl shadow-lg" />}

        {/* Chat Section */}
        <div className="space-y-4">
          <div className="max-h-96 overflow-y-auto p-4 border rounded-lg bg-pink-50">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={msg.role === 'user' ? 'text-right text-pink-800' : 'text-left text-pink-600'}>
                {msg.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 p-2 border rounded-lg"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="सन्देश लेख्नुहोस्..."
            />
            <button onClick={handleChatSend} disabled={isChatLoading} className="p-2 bg-pink-600 text-white rounded-lg">
              <Send />
            </button>
          </div>
        </div>

        <button onClick={reset} className="mt-6 p-2 bg-gray-200 rounded-lg">पुन: सुरु गर्नुहोस्</button>
      </div>
    );
  }

  // IDLE STATE
  return (
    <div className="w-full max-w-2xl mx-auto p-6 animate-in fade-in zoom-in duration-500">
      <textarea
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        placeholder="यहाँ तपाईंको भावनात्मक पाठ लेख्नुहोस्..."
        className="w-full p-3 border rounded-lg mb-4"
      />
      <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="mb-4" />
      
      <div className="flex gap-2 items-center mb-4">
        <button onClick={isRecording ? stopRecording : startRecording} className="p-2 bg-pink-600 text-white rounded-lg flex items-center gap-1">
          <Mic /> {isRecording ? "रेकर्डिङ रोक्नुहोस्" : "रेकर्डिङ सुरु गर्नुहोस्"}
        </button>
        {audioBase64 && (
          <>
            <button onClick={togglePlayback} className="p-2 bg-green-500 text-white rounded-lg">
              {isPlaying ? <Pause /> : <Play />}
            </button>
            <button onClick={clearAudio} className="p-2 bg-red-500 text-white rounded-lg"><Trash2 /></button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} width={400} height={80} className="mb-4 w-full rounded-lg bg-gray-100" />

      <button onClick={handleAnalysis} className="w-full p-3 bg-pink-600 text-white rounded-lg">
        <Sparkles /> हृदय विश्लेषण गर्नुहोस्
      </button>

      {error && <p className="text-red-600 mt-2">{error}</p>}

      <audio ref={audioRef} onEnded={handleAudioEnded} hidden />
    </d
