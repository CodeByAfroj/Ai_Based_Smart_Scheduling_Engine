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

  const playBeep = (ctx) => {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  };

  const startAlarmSound = () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContextRef.current = new AudioContext();
    }
    
    // Initial beep
    playBeep(audioContextRef.current);
    
    // Loop every 1 second
    alarmIntervalRef.current = setInterval(() => {
      playBeep(audioContextRef.current);
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
        if (!t.deadline) return false;
        
        const deadlineTime = new Date(t.deadline).getTime();
        // If deadline is passed, and we haven't dismissed it yet
        // Also only trigger for things recently due (within last 24h) to avoid old backlog spamming
        return deadlineTime <= now && (now - deadlineTime < 24 * 60 * 60 * 1000) && !dismissedAlarmsRef.current.has(t.id);
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300 border border-red-500/30">
        <div className="bg-red-50 dark:bg-red-500/10 p-6 flex flex-col items-center text-center border-b border-red-100 dark:border-red-500/20">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-500 mb-4 animate-pulse">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-1">Deadline Reached!</h2>
          <p className="text-slate-700 dark:text-slate-300 font-medium text-lg">
            {activeAlarmTask.name}
          </p>
        </div>
        
        <div className="p-6 flex flex-col gap-3">
          <button
            onClick={() => dismissCurrent(true)}
            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={20} />
            Mark Done
          </button>
          
          <button
            onClick={() => dismissCurrent(false)}
            className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <X size={20} />
            Dismiss
          </button>
        </div>
        
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-1">
            <Settings size={12} />
            Want silent notifications? Change this in <button onClick={() => { dismissCurrent(false); navigate('/settings'); }} className="text-indigo-500 hover:underline font-medium">Settings</button>
          </p>
        </div>
      </div>
    </div>
  );
}
