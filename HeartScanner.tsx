// HeartScanner.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  Loader2,
  Mic,
  Play,
  Pause,
  Trash2
} from 'lucide-react';

import type { AppState, HeartAnalysisResult, ChatMessage } from './types';
import { analyzeHeartContent, chatWithHeart } from './services/HeartService';
import EmotionChart from './EmotionChart';

// --- AUDIO UTILITY ---
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
      for (let j = 0; j < step && (start + j) < channelData.length; j++) sum += Math.abs(channelData[start + j]);
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

// --- COMPONENT ---
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

  // Result & Chat
  const [result, setResult] = useState<HeartAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Audio Recording
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

  const clearAudio = () => {
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

  const togglePlayback = () => {
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

  // Waveform drawing
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
    audioPeaks.forEach((peak, i) => {
      const x = i * (width / audioPeaks.length);
      const barHeight = peak * height;
      const y = (height - barHeight) / 2;
      ctx.fillStyle = (i / audioPeaks.length) < progress ? '#4ade80' : '#14532d';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 4);
      ctx.fill();
    });
  }, [audioPeaks, currentTime, audioDuration]);

  useEffect(() => {
    if (audioBase64 && audioRef.current) {
      audioRef.current.src = audioBase64;
      audioRef.current.load();
    }
  }, [audioBase64]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // --- HEART ANALYSIS ---
  const handleAnalysis = async () => {
    if (!textInput.trim() && !selectedImage && !audioBase64) return;

    setAppState(AppState.ANALYZING);
    setError(null);
    setResult(null);
    setChatMessages([]);

    try {
      const analysisResult = await analyzeHeartContent(textInput, selectedImage || undefined, audioBase64 || undefined);
      setResult(analysisResult);
      setAppState(AppState.RESULTS);
    } catch (err) {
      console.error(err);
      setError("हामीले तपाईंको हृदय पढ्न सकेनौं। कृपया पुन: प्रयास गर्नुहोस्।");
      setAppState(AppState.ERROR);
    }
  };

  // --- CHAT ---
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

  const reset = () => {
    setAppState(AppState.IDLE);
    setTextInput('');
    setSelectedImage(null);
    setAudioBase64(null);
    setResult(null);
    setChatMessages([]);
    setAudioPeaks([]);
  };

  // --- RENDER ---
  if (appState === AppState.ANALYZING) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-700">
        <Heart className="w-32 h-32 text-pink-600 heart-beat drop-shadow-lg" fill="currentColor" />
        <Loader2 className="w-12 h-12 text-white animate-spin mt-4" />
        <p className="mt-8 text-xl text-pink-200 animate-pulse">तपाईंको मुटुको आवाज सुन्दै...</p>
      </div>
    );
  }

  if (appState === AppState.RESULTS && result) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-8">
        <h2 className="text-2xl font-semibold text-pink-600">{result.summary}</h2>
        <EmotionChart emotions={result.emotions} />
        <div className="mt-4">
          <h3 className="font-medium">Guidance:</h3>
          <p>{result.guidance}</p>
        </div>
        <div className="mt-4 space-y-2">
          <h3 className="font-medium">Chat with your Heart:</h3>
          <div className="border p-2 h-64 overflow-y-auto">
            {chatMessages.map((msg, i) => (
              <p key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                <strong>{msg.role === 'user' ? 'तपाईं' : 'Heart'}:</strong> {msg.text}
              </p>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="flex mt-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              className="flex-1 border p-2"
              placeholder="Type your message..."
            />
            <button onClick={handleChatSend} className="ml-2 px-4 py-2 bg-pink-600 text-white rounded">Send</button>
          </div>
        </div>
        <button onClick={reset} className="mt-4 px-6 py-2 bg-gray-200 rounded">Reset</button>
      </div>
    );
  }

  // IDLE STATE
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <textarea
        value={textInput}
        onChange={e => setTextInput(e.target.value)}
        placeholder="तपाईंको भावनाहरू यहाँ लेख्नुहोस्..."
        className="w-full border p-2 rounded"
      />
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} />
      <div className="flex space-x-2 mt-2 items-center">
        {!isRecording && <button onClick={startRecording} className="px-4 py-2 bg-green-500 text-white rounded">Record</button>}
        {isRecording && <button onClick={stopRecording} className="px-4 py-2 bg-red-500 text-white rounded">Stop</button>}
        {audioBase64 && (
          <>
            <button onClick={togglePlayback} className="px-2 py-1 bg-blue-500 text-white rounded">{isPlaying ? <Pause /> : <Play />}</button>
            <button onClick={clearAudio} className="px-2 py-1 bg-gray-500 text-white rounded"><Trash2 /></button>
            <canvas ref={canvasRef} width={300} height={50} className="border ml-2" />
            <audio ref={audioRef} onEnded={handleAudioEnded} hidden />
          </>
        )}
      </div>
      <button onClick={handleAnalysis} className="mt-4 px-6 py-2 bg-pink-600 text-white rounded">Analyze Heart</button>
      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
  );
};

export default HeartScanner;
