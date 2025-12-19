import React from 'react';
import HeartScanner from './components/HeartScanner';

function App() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-[#0f0518] to-black text-white selection:bg-pink-500/30">
      {/* Background Ambient Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-blue-600/5 rounded-full blur-[96px]" />
      </div>

      {/* Main Content */}
      <main className="relative z-10 min-h-screen flex flex-col">
        <header className="p-6 flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity">
          <div className="text-sm tracking-widest uppercase text-white/50 font-semibold">जेमिनाई एआई</div>
          <div className="text-sm tracking-widest uppercase text-white/50 font-semibold">हृदयको गूंज</div>
        </header>
        
        <div className="flex-grow flex items-center justify-center p-4">
          <HeartScanner />
        </div>

        <footer className="p-6 text-center text-white/20 text-xs">
          <p>Google Gemini 2.5 Flash र Recharts द्वारा संचालित</p>
        </footer>
      </main>
    </div>
  );
}

export default App;