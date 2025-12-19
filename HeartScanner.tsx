import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Send, RefreshCw, Heart, Loader2, Sparkles, MessageCircle, Gem, Mic, Square, Feather, Play, Pause, Trash2, StopCircle } from 'lucide-react';
import { AppState, HeartAnalysisResult, ChatMessage } from '../types';
import { analyzeHeartContent, generateSoulImage, chatWithHeart } from '../services/geminiService';
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
    
    // Normalize
    const max = Math.max(...peaks) || 1;
    const normalized = peaks.map(p => Math.min(1, Math.max(0.1, p / max))); // Min height 10%
    
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
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        
        // Convert to Base64 for API
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };

        // Process for Visualization
        const { peaks, duration } = await extractAudioData(audioBlob);
        setAudioPeaks(peaks);
        setAudioDuration(duration);

        // Stop all tracks
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
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0); // Optional: Reset visual progress on end
  };

  // Animation Loop for Waveform
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (isPlaying) {
      render();
    } else {
      // Sync one last time when pausing
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
      cancelAnimationFrame(animationFrameId!);
    }

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
    const barWidth = (width / audioPeaks.length) - 2;
    const progress = audioDuration > 0 ? currentTime / audioDuration : 0;

    ctx.clearRect(0, 0, width, height);

    audioPeaks.forEach((peak, index) => {
      const x = index * (width / audioPeaks.length);
      const barHeight = peak * height;
      const y = (height - barHeight) / 2;

      // Determine color based on playback progress
      const isPlayed = (index / audioPeaks.length) < progress;
      ctx.fillStyle = isPlayed ? '#4ade80' : '#14532d'; // green-400 vs green-900 (darker)
      
      // Rounded rect (simplified)
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
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading]);

  // Sync audio source when recording changes
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

  // Render Logic
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
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-serif text-pink-100 drop-shadow-lg">हृदयको गूंज</h2>
          <p className="text-pink-200/90 italic text-xl leading-relaxed max-w-2xl mx-auto">{result.summary}</p>
        </div>

        {/* Soul Poem Section - New Feature */}
        <div className="glass-panel p-8 rounded-3xl bg-gradient-to-r from-pink-900/10 via-purple-900/10 to-pink-900/10 border border-pink-500/20 text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent opacity-50" />
            <Feather className="w-8 h-8 text-pink-300 mx-auto mb-4 opacity-80" />
            <h3 className="text-lg font-serif text-pink-200 mb-6 tracking-widest uppercase">आत्माको कविता</h3>
            <div className="text-xl md:text-2xl font-serif text-white leading-loose italic whitespace-pre-line drop-shadow-md">
              {result.soul_poem}
            </div>
            <div className="absolute bottom-[-20%] right-[-10%] w-32 h-32 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-all" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Visuals */}
          <div className="space-y-6">
            {/* Soul Image */}
            <div className="glass-panel p-2 rounded-2xl overflow-hidden shadow-2xl shadow-purple-900/30 relative group">
              {soulImage ? (
                <img 
                  src={soulImage} 
                  alt="Soul representation" 
                  className="w-full h-80 md:h-96 object-cover rounded-xl transform transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-80 md:h-96 bg-gray-900/50 flex items-center justify-center rounded-xl">
                  <Loader2 className="animate-spin text-pink-500" />
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <span className="text-sm text-pink-100 font-serif tracking-wide">आत्माको चित्रण</span>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="glass-panel p-6 rounded-2xl bg-gradient-to-b from-white/5 to-transparent">
              <h3 className="text-xl font-serif text-purple-200 mb-4 text-center">भावनात्मक तरंग</h3>
              <EmotionChart data={result.emotions} />
            </div>
          </div>

          {/* Right Column: Insights */}
          <div className="space-y-6">
             {/* Key Metrics Grid */}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="glass-panel p-5 rounded-2xl border-t border-t-pink-500/50">
                  <h4 className="text-xs uppercase tracking-widest text-pink-400 mb-2">प्रमुख भावना</h4>
                  <p className="text-2xl font-serif text-white capitalize">{result.dominant_emotion}</p>
               </div>
               <div className="glass-panel p-5 rounded-2xl border-t border-t-purple-500/50">
                  <h4 className="text-xs uppercase tracking-widest text-purple-400 mb-2">लुकेको चाहना</h4>
                  <p className="text-lg text-white font-light leading-tight">{result.hidden_desire}</p>
               </div>
               {/* Mystical Items */}
               <div className="glass-panel p-5 rounded-2xl flex items-center gap-4">
                  <div className="p-3 bg-yellow-500/20 rounded-full">
                    <Sparkles className="w-6 h-6 text-yellow-300" />
                  </div>
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-yellow-200 mb-1">आत्मिक प्रतीक</h4>
                    <p className="text-lg text-white font-serif">{result.spirit_archetype}</p>
                  </div>
               </div>
               <div className="glass-panel p-5 rounded-2xl flex items-center gap-4">
                  <div className="p-3 bg-cyan-500/20 rounded-full">
                    <Gem className="w-6 h-6 text-cyan-300" />
                  </div>
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-cyan-200 mb-1">उपचार रत्न</h4>
                    <p className="text-lg text-white font-serif">{result.healing_gemstone}</p>
                  </div>
               </div>
             </div>

             {/* Guidance */}
             <div className="glass-panel p-8 rounded-2xl border-l-4 border-l-pink-500 bg-gradient-to-br from-pink-900/10 via-purple-900/10 to-transparent">
                <h3 className="text-2xl font-serif text-pink-200 mb-4 flex items-center gap-2">
                  <Heart className="w-6 h-6" /> सुझाव
                </h3>
                <p className="text-xl leading-relaxed text-gray-100 font-light italic">
                  "{result.guidance}"
                </p>
             </div>
          </div>
        </div>

        {/* Chat Section */}
        <div className="max-w-3xl mx-auto mt-12">
          <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#1a0b2e]/80 backdrop-blur-xl">
             <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
               <MessageCircle className="text-pink-400 w-5 h-5" />
               <h3 className="text-lg font-serif text-pink-100">हृदय संवाद (Heart Conversation)</h3>
             </div>
             
             <div className="h-80 overflow-y-auto p-6 space-y-4">
               {chatMessages.length === 0 && (
                 <div className="text-center text-white/30 text-sm py-10 italic">
                   तपाईंको हृदय सुन्दैछ। केहि सोध्नुहोस्...
                 </div>
               )}
               {chatMessages.map((msg, idx) => (
                 <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-4 rounded-2xl text-base ${
                     msg.role === 'user' 
                       ? 'bg-pink-600/20 border border-pink-500/30 text-white rounded-tr-none' 
                       : 'bg-white/10 border border-white/10 text-pink-100 rounded-tl-none'
                   }`}>
                     {msg.text}
                   </div>
                 </div>
               ))}
               {isChatLoading && (
                 <div className="flex justify-start">
                   <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none">
                     <div className="flex gap-1">
                       <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                       <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                       <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                     </div>
                   </div>
                 </div>
               )}
               <div ref={chatEndRef} />
             </div>

             <div className="p-4 border-t border-white/10 bg-black/20 flex gap-3">
               <input 
                 type="text" 
                 value={chatInput}
                 onChange={(e) => setChatInput(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                 placeholder="यहाँ सोध्नुहोस्..."
                 className="flex-1 bg-transparent border-none text-white focus:ring-0 placeholder-white/30"
               />
               <button 
                 onClick={handleChatSend}
                 disabled={!chatInput.trim() || isChatLoading}
                 className="p-2 bg-pink-600 rounded-full text-white hover:bg-pink-500 transition-colors disabled:opacity-50"
               >
                 <Send className="w-5 h-5" />
               </button>
             </div>
          </div>
        </div>
        
        <div className="text-center pt-8">
            <button 
              onClick={reset}
              className="px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-purple-200 inline-flex items-center gap-2 group hover:border-pink-500/30"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              नयाँ सुरुवात गर्नुहोस्
            </button>
        </div>

      </div>
    );
  }

  // IDLE STATE
  return (
    <div className="w-full max-w-2xl mx-auto p-6 animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-10 space-y-4">
        <div className="inline-block p-4 rounded-full bg-pink-500/10 mb-4 border border-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
          <Heart className="w-12 h-12 text-pink-500" />
        </div>
        <h1 className="text-4xl md:text-6xl font-serif text-white drop-shadow-lg tracking-tight">तपाईंको मनमा के छ?</h1>
        <p className="text-lg text-purple-200/80 font-light max-w-lg mx-auto leading-relaxed">
          आफ्ना विचारहरू साझा गर्नुहोस्, तस्बिर अपलोड गर्नुहोस् वा <span className="text-pink-300 font-medium">आफ्नो आवाजमा बोल्नुहोस्</span>। 
        </p>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-2xl shadow-purple-900/30 border border-white/10 backdrop-blur-xl">
        
        {/* Text Input */}
        <div className="mb-6 relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-600/20 to-purple-600/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="आज तपाई कस्तो महसुस गर्दै हुनुहुन्छ? मनमा जे आउँछ लेख्नुहोस्..."
            className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder-purple-300/30 focus:outline-none focus:ring-1 focus:ring-pink-500/50 resize-none transition-all text-lg relative z-10"
          />
        </div>

        {/* Media Inputs (Camera & Voice) */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Image Upload */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border border-dashed border-white/20 cursor-pointer transition-all hover:bg-white/5 group ${selectedImage ? 'bg-pink-900/20 border-pink-500/50' : ''}`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload}
            />
            {selectedImage ? (
              <>
                 <img src={selectedImage} alt="Preview" className="w-10 h-10 rounded-full object-cover border border-white/20" />
                 <span className="text-sm text-pink-200">तस्बिर छनोट भयो</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5 text-purple-300 group-hover:text-pink-300 transition-colors" />
                <span className="text-sm text-purple-200 group-hover:text-pink-200 transition-colors">तस्बिर (Image)</span>
              </>
            )}
          </div>

          {/* Voice Input */}
          <div className="flex-1">
            <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
            
            {audioBase64 ? (
              // RECORDED STATE WITH VISUALIZATION
              <div className="flex items-center justify-between gap-3 p-2 rounded-xl border border-dashed border-green-500/50 bg-green-900/20 transition-all h-[60px]">
                <button 
                  onClick={togglePlayback}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 text-white transition-colors"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                
                {/* Visualizer Canvas */}
                <div className="flex-1 h-full flex items-center justify-center px-2">
                   <canvas ref={canvasRef} width={200} height={40} className="w-full h-full" />
                </div>
                
                <button 
                  onClick={clearAudio}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-red-300 hover:text-red-200 transition-colors"
                  title="हटाउनुहोस् (Delete)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : isRecording ? (
              // RECORDING STATE
              <div 
                onClick={stopRecording}
                className="flex items-center justify-center gap-3 p-4 rounded-xl border border-dashed border-red-500/50 bg-red-900/20 cursor-pointer animate-pulse transition-all h-[60px]"
              >
                <Square className="w-5 h-5 text-red-400 fill-current" />
                <span className="text-sm text-red-200">रोक्नुहोस् (Stop)</span>
              </div>
            ) : (
              // IDLE STATE
              <div 
                onClick={startRecording}
                className="flex items-center justify-center gap-3 p-4 rounded-xl border border-dashed border-white/20 cursor-pointer transition-all hover:bg-white/5 group h-[60px]"
              >
                <Mic className="w-5 h-5 text-purple-300 group-hover:text-pink-300 transition-colors" />
                <span className="text-sm text-purple-200 group-hover:text-pink-200 transition-colors">बोल्नुहोस् (Voice)</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/30 text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleAnalysis}
          disabled={!textInput && !selectedImage && !audioBase64}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-medium text-xl shadow-lg shadow-pink-900/40 hover:shadow-pink-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300" />
          <Send className="w-5 h-5 relative z-10" />
          <span className="relative z-10">मेरो हृदय खोल्नुहोस्</span>
        </button>
      </div>
    </div>
  );
};

export default HeartScanner;