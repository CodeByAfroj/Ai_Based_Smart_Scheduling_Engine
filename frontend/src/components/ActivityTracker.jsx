import { useAuth } from '../contexts/AuthContext';
import { useLiveTracking } from '../contexts/TrackingContext';
import { Activity, Play, Square, AlertCircle, RefreshCw } from 'lucide-react';

export default function ActivityTracker() {
  const { token } = useAuth();
  const { tracking, error, status, toggle } = useLiveTracking();

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
          onClick={toggle}
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
