import { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, TreeDeciduous } from 'lucide-react';

export default function FocusModeOverlay({ isOpen, onClose, task = null }) {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const startTimeRef = useRef(null);
  
  useEffect(() => {
    if (isOpen) {
      setSeconds(0);
      setIsActive(true);
      startTimeRef.current = Date.now();
      // Add class to body to prevent scrolling
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    let interval = null;
    if (isActive && isOpen) {
      interval = setInterval(() => {
        setSeconds(seconds => seconds + 1);
      }, 1000);
    } else if (!isActive && seconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds, isOpen]);

  const handleClose = async () => {
    // Record session before closing
    setIsActive(false);
    console.log(`[Focus Mode] Closing overlay. Total focused seconds: ${seconds}`);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.warn("[Focus Mode] No auth token found. Cannot save session.");
      } else if (seconds > 0) { 
        console.log(`[Focus Mode] Sending POST request to save session of ${seconds}s...`);
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/tasks/focus-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            task_id: task?.id || null,
            duration_seconds: seconds,
            status: 'completed'
          })
        });
        
        if (response.ok) {
          console.log("[Focus Mode] Successfully saved focus session to backend!");
        } else {
          console.error("[Focus Mode] Failed to save. Server responded with status:", response.status);
        }
      } else {
        console.log("[Focus Mode] Session was 0 seconds. Not saving to backend.");
      }
    } catch (err) {
      console.error('[Focus Mode] Failed to record focus session:', err);
    }
    onClose();
  };

  if (!isOpen) return null;

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-lg">
      <div className="w-full h-full lg:w-[400px] lg:h-[700px] lg:max-h-[90vh] bg-[#0c1410] lg:rounded-3xl lg:border border-[#1f3b2a] shadow-2xl flex flex-col relative overflow-hidden transition-all">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 relative z-10">
          <div className="flex items-center gap-2 text-emerald-400">
            <TreeDeciduous size={20} />
            <span className="text-sm font-semibold tracking-wide uppercase">Deep Focus</span>
          </div>
          <button 
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
          {task && (
            <div className="text-center mb-10 max-w-full">
              <p className="text-gray-400 text-sm mb-2 uppercase tracking-widest font-medium">Focusing On</p>
              <h3 className="text-xl font-medium text-white truncate">{task.name}</h3>
            </div>
          )}

          <div className="text-[5rem] font-light text-white tracking-tighter mb-16 tabular-nums">
            {formatTime(seconds)}
          </div>

          <button 
            onClick={() => setIsActive(!isActive)}
            className="w-20 h-20 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all transform hover:scale-105 active:scale-95"
          >
            {isActive ? <Pause size={32} className="fill-current" /> : <Play size={32} className="fill-current ml-1" />}
          </button>
          
          <p className="mt-8 text-sm text-gray-500 font-medium tracking-wide">
            {isActive ? "Stay present. Stay focused." : "Timer paused."}
          </p>
        </div>
      </div>
    </div>
  );
}
