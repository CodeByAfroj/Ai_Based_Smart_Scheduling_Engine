import React, { useState, useEffect } from 'react';
import { X, Play, Square, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { startFocusMode, stopFocusMode, forceAppToForeground } from '../utils/nativeBridge';

const DEFAULT_ALLOWED_APPS = ['Chrome', 'Notes', 'YouTube', 'Gmail', 'Drive'];

export default function FocusRunnerModal({ task, onClose, onComplete }) {
  const [isActive, setIsActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distractions, setDistractions] = useState([]);
  const [showDistractionWarning, setShowDistractionWarning] = useState(null);
  
  // Audio context for aggressive chime
  const playAggressiveChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // Jump to A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.2); // Back to A4
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1);
    } catch (e) {
      console.error('Audio playback failed', e);
    }
  };

  const handleStart = () => {
    setIsActive(true);
    startFocusMode(DEFAULT_ALLOWED_APPS, (distractingApp) => {
      // Callback when a distraction is detected
      playAggressiveChime();
      forceAppToForeground();
      setDistractions(prev => [...prev, distractingApp]);
      setShowDistractionWarning(distractingApp);
      
      // Auto-hide warning after 5 seconds
      setTimeout(() => setShowDistractionWarning(null), 5000);
    });
  };

  const handleStop = () => {
    setIsActive(false);
    stopFocusMode();
  };

  useEffect(() => {
    let timer;
    if (isActive) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      clearInterval(timer);
      stopFocusMode();
    };
  }, [isActive]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleComplete = () => {
    handleStop();
    onComplete(task.id, Math.floor(elapsedTime / 60)); // convert seconds to minutes
  };

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      {showDistractionWarning && (
        <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-red-950/90 animate-pulse">
          <AlertTriangle size={80} className="text-red-500 mb-6" />
          <h2 className="text-4xl font-black text-white text-center px-4 leading-tight mb-4">
            DISTRACTION DETECTED!
          </h2>
          <p className="text-xl text-red-200 text-center px-4">
            Get off <span className="font-bold text-white">{showDistractionWarning}</span> and get back to work!
          </p>
        </div>
      )}

      <div className="bg-gradient-to-b from-[var(--bg-panel)] to-[var(--bg-app)] border border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative">
        <button 
          onClick={() => { handleStop(); onClose(); }}
          className="absolute top-4 right-4 p-2 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <ShieldCheck size={20} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-main)] text-lg leading-tight">Focus Mode</h3>
            <p className="text-sm text-[var(--text-muted)]">Strict tracking enabled</p>
          </div>
        </div>

        <div className="bg-[var(--bg-hover)] rounded-2xl p-5 mb-8 text-center border border-[var(--border-subtle)]">
          <h4 className="text-[var(--text-muted)] text-sm mb-2 font-medium">Currently Focusing On</h4>
          <h2 className="text-2xl font-black text-[var(--text-main)]">{task.name}</h2>
          
          <div className="mt-8 mb-4">
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[var(--accent-base)] to-indigo-600 font-mono tracking-wider">
              {formatTime(elapsedTime)}
            </div>
          </div>
          
          {distractions.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
              <AlertTriangle size={12} /> {distractions.length} Distractions caught
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {!isActive ? (
            <button 
              onClick={handleStart}
              className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-[var(--accent-base)] text-white hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/25"
            >
              <Play size={18} fill="currentColor" /> Start Focus Session
            </button>
          ) : (
            <button 
              onClick={handleStop}
              className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
            >
              <Square size={18} fill="currentColor" /> Pause Timer
            </button>
          )}

          <button 
            onClick={handleComplete}
            className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-green-500/20 text-green-500 hover:bg-green-500/30 border border-green-500/30 transition-colors mt-2"
          >
            <CheckCircle2 size={18} /> Mark Task Complete
          </button>
        </div>
      </div>
    </div>
  );
}
