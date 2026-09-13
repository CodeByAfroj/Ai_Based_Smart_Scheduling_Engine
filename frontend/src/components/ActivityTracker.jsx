import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { Activity, Play, Square, AlertCircle, RefreshCw } from 'lucide-react';

export default function ActivityTracker() {
  const { token, API_BASE } = useAuth();
  const { fetchTasks } = useTasks();
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null); // { activity: 'walking', busy: true, confidence: 0.95 }
  const bufferRef = useRef([]);
  const timerRef = useRef(null);

  // Fallback for non-mobile devices or lack of permissions
  const requestPermission = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceMotionEvent.requestPermission();
        if (permissionState === 'granted') {
          return true;
        } else {
          setError('Permission denied for device motion sensors.');
          return false;
        }
      } catch (err) {
        setError('Error requesting permission.');
        return false;
      }
    }
    // Non-iOS 13+ devices
    return true;
  };

  const handleMotion = (event) => {
    const { accelerationIncludingGravity, rotationRate } = event;
    const reading = {
      timestamp: Date.now(),
      accel_x: accelerationIncludingGravity?.x || 0,
      accel_y: accelerationIncludingGravity?.y || 0,
      accel_z: accelerationIncludingGravity?.z || 0,
      gyro_x: rotationRate?.alpha || 0,
      gyro_y: rotationRate?.beta || 0,
      gyro_z: rotationRate?.gamma || 0
    };
    bufferRef.current.push(reading);
  };

  const sendBuffer = async () => {
    if (bufferRef.current.length < 5) {
      // Not enough data yet
      bufferRef.current = [];
      return;
    }
    const currentBuffer = [...bufferRef.current];
    bufferRef.current = []; // Clear for next window

    try {
      const res = await fetch(`${API_BASE}/classify-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          window_duration_sec: 2.5,
          readings: currentBuffer
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        
        // If busy, we can optionally trigger a backend reschedule here
        if (data.busy) {
          triggerAutoShift();
        }
      }
    } catch (err) {
      console.error('Failed to classify activity', err);
    }
  };

  const triggerAutoShift = async () => {
    // We will call a specialized endpoint for auto-shifting if busy
    try {
      const res = await fetch(`${API_BASE}/auto-shift`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchTasks(true); // Force refresh global task context to show new schedule
      }
    } catch (err) {
      console.error('Auto shift failed', err);
    }
  };

  const toggleTracking = async () => {
    if (tracking) {
      window.removeEventListener('devicemotion', handleMotion);
      clearInterval(timerRef.current);
      setTracking(false);
      bufferRef.current = [];
      setStatus(null);
    } else {
      const granted = await requestPermission();
      if (!granted) return;

      setError('');
      window.addEventListener('devicemotion', handleMotion);
      
      // Send buffer to backend every 2.5 seconds
      timerRef.current = setInterval(sendBuffer, 2500);
      setTracking(true);
    }
  };

  useEffect(() => {
    return () => {
      if (tracking) {
        window.removeEventListener('devicemotion', handleMotion);
        clearInterval(timerRef.current);
      }
    };
  }, [tracking]);

  if (!token) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      {error && (
        <div className="bg-red-50 text-red-700 p-2 rounded-lg text-xs font-bold shadow flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </div>
      )}
      
      <div className={`flex items-center gap-3 p-3 rounded-2xl shadow-xl border ${
        tracking 
          ? (status?.busy ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')
          : 'bg-white border-slate-200'
      }`}>
        <button 
          onClick={toggleTracking}
          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner text-white transition-colors ${
            tracking ? 'bg-slate-800 hover:bg-slate-700' : 'bg-[var(--accent-base)] hover:bg-indigo-700'
          }`}
        >
          {tracking ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        
        <div className="flex flex-col min-w-[120px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
            <Activity size={10} className={tracking ? "animate-pulse text-green-500" : ""} /> 
            {tracking ? 'Sensor Stream' : 'Live Tracking Off'}
          </span>
          {tracking ? (
            status ? (
              <span className={`text-sm font-bold capitalize ${status.busy ? 'text-red-700' : 'text-green-700'}`}>
                {status.activity} {status.busy ? '(Busy)' : '(Free)'}
              </span>
            ) : (
              <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                <RefreshCw size={12} className="animate-spin" /> Analyzing...
              </span>
            )
          ) : (
            <span className="text-sm font-bold text-[var(--text-main)]">Enable to start</span>
          )}
        </div>
      </div>
    </div>
  );
}
