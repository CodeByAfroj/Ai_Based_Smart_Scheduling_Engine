import { useEffect, useState, useRef } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, CheckCircle2, X, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TaskAlarmManager() {
  const { tasks, updateTask } = useTasks();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [activeAlarmTask, setActiveAlarmTask] = useState(null);
  
  const audioContextRef = useRef(null);
  const alarmIntervalRef = useRef(null);
  const vibrationIntervalRef = useRef(null);

  // Load dismissed alarms from local storage
  const dismissedAlarmsRef = useRef(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('tp_dismissed_alarms') || '[]'));
    } catch {
      return new Set();
    }
  });

  if (dismissedAlarmsRef.current instanceof Function) {
    dismissedAlarmsRef.current = dismissedAlarmsRef.current();
  }

  const stopAlarm = () => {
    // stop audio
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    
    // stop vibration
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    try { navigator.vibrate(0); } catch(e){}
    
    // stop speech
    window.speechSynthesis?.cancel();
  };

  const dismissCurrent = (markDone = false) => {
    if (activeAlarmTask) {
      if (markDone) {
        updateTask(activeAlarmTask.id, { status: 'completed' });
      }
      
      const newSet = new Set(dismissedAlarmsRef.current);
      newSet.add(activeAlarmTask.id);
      dismissedAlarmsRef.current = newSet;
      localStorage.setItem('tp_dismissed_alarms', JSON.stringify([...newSet]));
      
      stopAlarm();
      setActiveAlarmTask(null);
    }
  };

  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      // Sawtooth cuts through background noise much better on phone speakers
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.1); // E6 note
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.05); // MAX VOLUME
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      
      // Clean up after beep
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 1000);
    } catch (e) {
      console.warn('Audio playback failed', e);
    }
  };

  const startAlarmSound = () => {
    // Initial beep
    playBeep();
    
    // Loop every 1 second
    alarmIntervalRef.current = setInterval(() => {
      playBeep();
    }, 1000);
  };

  const startVibration = () => {
    if (!navigator.vibrate) return;
    
    // Vibrate immediately
    navigator.vibrate([500, 250, 500]);
    
    // Loop
    vibrationIntervalRef.current = setInterval(() => {
      navigator.vibrate([500, 250, 500]);
    }, 2000);
  };

  const startVoice = (taskName) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(`Let's complete this task: ${taskName}`);
    
    // Speak once
    window.speechSynthesis.speak(utterance);
    
    // To make it persistent until dismissed, we can repeat every 5 seconds
    alarmIntervalRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
         window.speechSynthesis.speak(new SpeechSynthesisUtterance(`Reminder to complete: ${taskName}`));
      }
    }, 5000);
  };

  const triggerAlarm = (task) => {
    setActiveAlarmTask(task);
    
    const pref = profile?.notification_preference || 'text_and_sound';
    
    stopAlarm(); // clear any existing
    
    // Trigger OS-level notification if permitted (this guarantees system sound/vibrate)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('TaskPulse Reminder', {
          body: `It's time for your task: ${task.name}`,
          icon: '/favicon.ico', // fallback icon
          requireInteraction: true
        });
      } catch (e) {
        // Fallback for mobile Safari which requires Service Worker for notifications
        console.warn('System notification failed, relying on in-app alerts', e);
      }
    }
    
    if (pref === 'sound' || pref === 'text_and_sound') {
      startAlarmSound();
    } else if (pref === 'vibrate') {
      startVibration();
    } else if (pref === 'voice') {
      startVoice(task.name);
    }
    // if 'silent', do nothing but show the overlay
  };

  useEffect(() => {
    if (!tasks || tasks.length === 0) return;
    
    const checkDeadlines = () => {
      // Don't interrupt an active alarm
      if (activeAlarmTask) return;
      
      const now = Date.now();
      
      const dueTask = tasks.find(t => {
        if (t.status === 'completed') return false;
        
        // Use scheduled_end if the task has been auto-scheduled, otherwise fallback to deadline
        const targetTimeStr = t.scheduled_end || t.deadline;
        if (!targetTimeStr) return false;
        
        const targetTime = new Date(targetTimeStr).getTime();
        
        // If the scheduled end time (or deadline) is passed, and we haven't dismissed it yet
        // Also only trigger for things recently due (within last 24h) to avoid old backlog spamming
        return targetTime <= now && (now - targetTime < 24 * 60 * 60 * 1000) && !dismissedAlarmsRef.current.has(t.id);
      });
      
      if (dueTask) {
        triggerAlarm(dueTask);
      }
    };
    
    checkDeadlines();
    const interval = setInterval(checkDeadlines, 10000);
    return () => clearInterval(interval);
  }, [tasks, activeAlarmTask, profile]);

  if (!activeAlarmTask) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Animated Dark Overlay with Radial Glow */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-500/20 via-transparent to-transparent opacity-70 animate-pulse"></div>

      {/* Glassmorphism Modal */}
      <div className="relative w-full max-w-sm rounded-[32px] bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_-12px_rgba(239,68,68,0.4)] overflow-hidden animate-in fade-in zoom-in-95 duration-500 spring-wobble">
        
        <div className="relative p-8 flex flex-col items-center text-center">
          {/* Animated Radar/Ping Effect Behind Icon */}
          <div className="relative mb-8 mt-4">
            <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }}></div>
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.6)]">
              <AlertCircle size={40} className="text-white animate-pulse" />
            </div>
          </div>

          <h2 className="text-2xl font-black bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-2 tracking-tight">
            Deadline Reached!
          </h2>
          <p className="text-red-100/90 font-medium text-lg px-4 leading-snug">
            {activeAlarmTask.name}
          </p>
        </div>
        
        <div className="p-6 pt-2 flex flex-col gap-3">
          <button
            onClick={() => dismissCurrent(true)}
            className="group relative w-full py-4 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-2xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 flex items-center justify-center gap-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <CheckCircle2 size={22} className="relative z-10" />
            <span className="relative z-10">Mark Done</span>
          </button>
          
          <button
            onClick={() => dismissCurrent(false)}
            className="w-full py-4 px-4 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-2xl font-medium transition-all flex items-center justify-center gap-2 border border-white/5 hover:border-white/10"
          >
            <X size={20} />
            Dismiss
          </button>
        </div>
        
        <div className="px-6 py-5 bg-black/40 border-t border-white/5">
          <p className="text-[11px] text-white/40 text-center flex items-center justify-center gap-1.5 font-medium tracking-wide uppercase">
            <Settings size={12} />
            Want silent notifications? Change in <button onClick={() => { dismissCurrent(false); navigate('/settings'); }} className="text-indigo-400 hover:text-indigo-300 hover:underline">Settings</button>
          </p>
        </div>
      </div>
    </div>
  );
}
