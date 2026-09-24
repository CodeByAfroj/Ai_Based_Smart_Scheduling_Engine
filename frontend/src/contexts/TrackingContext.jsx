import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { setLocalAIEnabled, isTWA } from '../utils/nativeBridge';

import { useTasks } from './TaskContext';

const TrackingContext = createContext();

export function TrackingProvider({ children }) {
  const { token, API_BASE } = useAuth();
  const { fetchTasks } = useTasks();
  
  // Persist tracking state across refreshes
  const [tracking, setTracking] = useState(() => {
    return localStorage.getItem('taskpulse_tracking') === 'true';
  });
  
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  
  const bufferRef = useRef([]);
  const timerRef = useRef(null);

  const handleMotion = (event) => {
    const { accelerationIncludingGravity, rotationRate } = event;
    bufferRef.current.push({
      timestamp: Date.now(),
      accel_x: accelerationIncludingGravity?.x || 0,
      accel_y: accelerationIncludingGravity?.y || 0,
      accel_z: accelerationIncludingGravity?.z || 0,
      gyro_x: rotationRate?.x || 0,
      gyro_y: rotationRate?.y || 0,
      gyro_z: rotationRate?.z || 0,
    });
  };

  const sendBuffer = async () => {
    if (bufferRef.current.length < 50) { bufferRef.current = []; return; }
    const batch = [...bufferRef.current];
    bufferRef.current = [];
    try {
      const res = await fetch(`${API_BASE}/classify-activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ window_duration_sec: 5.0, readings: batch }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.busy) {
          await fetch(`${API_BASE}/auto-shift`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          fetchTasks(true);
        }
      }
    } catch { /* silent */ }
  };

  // React to tracking state changes
  useEffect(() => {
    if (tracking) {
      localStorage.setItem('taskpulse_tracking', 'true');
      if (isTWA()) {
        // Mobile Native: Only use Local AI, do not hit backend
        setLocalAIEnabled(true);
        setStatus({ activity: 'Monitoring via Local AI', confidence: 1.0, busy: false });
      } else {
        // Web PWA: Use web sensors and Render backend API
        window.addEventListener('devicemotion', handleMotion);
        timerRef.current = setInterval(sendBuffer, 5000);
      }
    } else {
      localStorage.setItem('taskpulse_tracking', 'false');
      if (isTWA()) {
        setLocalAIEnabled(false);
      } else {
        window.removeEventListener('devicemotion', handleMotion);
        clearInterval(timerRef.current);
      }
      setStatus(null);
      bufferRef.current = [];
    }

    return () => {
      if (!isTWA()) {
        window.removeEventListener('devicemotion', handleMotion);
        clearInterval(timerRef.current);
      }
    };
  }, [tracking, token]); // re-run if token changes or tracking state changes

  const toggle = async () => {
    if (tracking) {
      setTracking(false);
    } else {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
          const perm = await DeviceMotionEvent.requestPermission();
          if (perm !== 'granted') { setError('Motion sensor permission denied.'); return; }
        } catch { setError('Could not request sensor permission.'); return; }
      }
      setError('');
      setTracking(true);
    }
  };

  return (
    <TrackingContext.Provider value={{ tracking, error, status, toggle }}>
      {children}
    </TrackingContext.Provider>
  );
}

export const useLiveTracking = () => useContext(TrackingContext);
