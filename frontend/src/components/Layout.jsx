import { useEffect, useState, useRef, useCallback } from 'react';
import {
  LayoutGrid,
  CheckSquare,
  Calendar,
  User,
  Search,
  Bell,
  BarChart2,
  Link,
  Settings,
  Zap,
  LogOut,
  ChevronDown,
  AlertCircle,
  Clock,
  X as XIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ListTodo,
  HelpCircle,
} from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import ChatButton from './ChatButton';
import UserGuideTour from './UserGuideTour';
import TaskAlarmManager from './TaskAlarmManager';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    profile,
    logout,
    readinessScore = 100,
    token,
    API_BASE,
  } = useAuth();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);

  // Toast alerts (deadline / fixed-task)
  const [toasts, setToasts] = useState([]);
  // Active fixed-task banner (task that is due NOW and still pending)
  const [activeFixedBanner, setActiveFixedBanner] = useState(null);
  // Overdue triage
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [showTriagePanel, setShowTriagePanel] = useState(false);
  const [dismissedOverdueIds, setDismissedOverdueIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('tp_dismissed_overdue') || '[]')); }
    catch { return new Set(); }
  });

  const { tasks, updateTask } = useTasks();

  const notifiedIdsRef = useRef(
    (() => { try { return new Set(JSON.parse(localStorage.getItem('tp_notified_ids') || '[]')); } catch { return new Set(); } })()
  );
  // Tracks which (taskId + threshold) combos have already been alerted — persisted across refreshes
  const deadlineAlertedRef = useRef(() => {
    try { return new Set(JSON.parse(localStorage.getItem('tp_deadline_alerted') || '[]')); }
    catch { return new Set(); }
  });
  // Initialize the ref value from the factory fn (useRef doesn't call functions)
  if (deadlineAlertedRef.current instanceof Function) {
    deadlineAlertedRef.current = deadlineAlertedRef.current();
  }

  // ── Toast helpers ────────────────────────────────────────────────────────
  const pushToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, ...toast }]); // max 5
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000);
  }, []);

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Overdue task detection ────────────────────────────────────────────────
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;
    const detectOverdue = () => {
      const now = Date.now();
      const overdue = tasks.filter(t =>
        t.status !== 'completed' &&
        t.deadline &&
        new Date(t.deadline).getTime() < now &&
        !dismissedOverdueIds.has(t.id)
      );
      setOverdueTasks(overdue);
      // Auto-open triage panel if there are new overdue tasks
      if (overdue.length > 0) setShowTriagePanel(false); // reset so banner re-appears
    };
    detectOverdue();
    const interval = setInterval(detectOverdue, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [tasks, dismissedOverdueIds]);

  // Reschedule: push deadline +24h from now
  const rescheduleTask = (task) => {
    const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const newStart = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // start in 30min
    updateTask(task.id, { deadline: newDeadline, earliest_start: newStart, status: 'pending' });
    dismissOverdueTask(task.id);
    pushToast({ title: '🔄 Rescheduled', message: `"${task.name}" moved to tomorrow.`, urgent: false });
  };

  const dismissOverdueTask = (id) => {
    setDismissedOverdueIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('tp_dismissed_overdue', JSON.stringify([...next]));
      return next;
    });
    setOverdueTasks(prev => prev.filter(t => t.id !== id));
  };


  // Close menus when clicking/tapping anywhere outside — works on all screen sizes
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-notif-menu]')) setShowNotifMenu(false);
      if (!e.target.closest('[data-user-menu]')) setShowUserMenu(false);
    };
    
    const handleCloseDropdowns = () => {
      setShowNotifMenu(false);
      setShowUserMenu(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('close_dropdowns', handleCloseDropdowns);
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('close_dropdowns', handleCloseDropdowns);
    };
  }, []);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!token || !API_BASE) return undefined;

    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE}/notifications/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.notifications) {
          const freshNotifications = data.notifications;
          setNotifications(freshNotifications.slice(0, 10));
          
          let hasNewUnread = false;
          
          for (const n of freshNotifications) {
            if (!n.is_read) {
              setHasUnread(true);
              
              if (!notifiedIdsRef.current.has(n.id)) {
                hasNewUnread = true;
                notifiedIdsRef.current.add(n.id);
                try { localStorage.setItem('tp_notified_ids', JSON.stringify([...notifiedIdsRef.current])); } catch (_) {}
                triggerAudioAlert(n.title || 'Alert', n.message || '');
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    // Initial fetch
    fetchNotifications();

    // Poll every 15 seconds
    const intervalId = setInterval(fetchNotifications, 15000);

    return () => clearInterval(intervalId);
  }, [token, API_BASE, profile?.notification_preference]);

  // ── Deadline + Fixed-task alert engine ───────────────────────────────────
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    const checkDeadlines = () => {
      const now = Date.now();

      tasks.forEach(task => {
        if (!task.deadline || task.status === 'completed') return;

        const deadlineMs = new Date(task.deadline).getTime();
        const msLeft = deadlineMs - now;
        const minutesLeft = Math.floor(msLeft / 60000);

        // Define urgency thresholds (in minutes)
        const thresholds = [
          { key: '1440', mins: 1440, label: '24 hours',  urgent: false },
          { key: '120',  mins: 120,  label: '2 hours',   urgent: true  },
          { key: '30',   mins: 30,   label: '30 minutes', urgent: true  },
          { key: '0',    mins: 0,    label: 'RIGHT NOW',  urgent: true  },
        ];

        thresholds.forEach(({ key, mins, label, urgent }) => {
          const alertKey = `${task.id}:${key}`;
          // Fire when minutesLeft crosses from above to at-or-below threshold
          if (minutesLeft <= mins + 2 && minutesLeft >= mins - 2 && !deadlineAlertedRef.current.has(alertKey)) {
            deadlineAlertedRef.current.add(alertKey);
            // Persist so alerts don't re-fire after page refresh
            try { localStorage.setItem('tp_deadline_alerted', JSON.stringify([...deadlineAlertedRef.current])); } catch (_) {}

            const title = urgent ? '⚠️ Deadline Approaching!' : '🔔 Deadline Reminder';
            const body = mins === 0
              ? `"${task.name}" deadline has arrived! Complete it now.`
              : `"${task.name}" is due in ${label}. Deadline is approaching!`;

            // In-app toast
            pushToast({
              title,
              message: body,
              urgent,
              taskId: task.id,
              taskName: task.name,
              type: 'deadline',
            });

            // Native OS notification + audio
            triggerAudioAlert(title, body);
          }
        });

        // ── Fixed task "time is now" banner ─────────────────────────────
        if (task.fixed && task.status !== 'completed' && task.earliest_start) {
          const startMs = new Date(task.earliest_start).getTime();
          const endMs   = task.deadline ? new Date(task.deadline).getTime() : startMs + (task.duration_minutes || 60) * 60000;
          // Show banner from scheduled start to scheduled end
          if (now >= startMs && now <= endMs) {
            setActiveFixedBanner(task);
          }
        }
      });

      // Clear fixed banner if no fixed task is currently active
      setActiveFixedBanner(prev => {
        if (!prev) return null;
        const stillActive = tasks.find(t =>
          t.id === prev.id &&
          t.status !== 'completed' &&
          t.fixed &&
          t.earliest_start &&
          Date.now() >= new Date(t.earliest_start).getTime() &&
          Date.now() <= (t.deadline ? new Date(t.deadline).getTime() : new Date(t.earliest_start).getTime() + (t.duration_minutes || 60) * 60000)
        );
        return stillActive || null;
      });
    };

    checkDeadlines(); // run immediately
    const interval = setInterval(checkDeadlines, 60000); // then every minute
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, pushToast]);

  const playHumanizedVoice = async (textToSpeak) => {
    if (!textToSpeak || !textToSpeak.trim()) return;
    const cleanText = textToSpeak
      .replace(/[\*\_`#\[\]\(\)>~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 1. Try Neural Edge-TTS Endpoint (/nlp/tts) for hyper-realistic ChatGPT Ava Neural Voice
    try {
      const selectedVoice = localStorage.getItem('taskpulse_selected_voice_uri') || 'en-US-AvaNeural';
      const response = await fetch(`${API_BASE}/nlp/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: cleanText,
          voice: selectedVoice
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        await audio.play();
        return;
      }
    } catch (err) {
      console.warn('Neural TTS notification endpoint fallback to Web Speech:', err);
    }

    // 2. Fallback to Web Speech API with Natural Voice Selection & Cadence Tuning
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = 0.96;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.voiceURI === localStorage.getItem('taskpulse_selected_voice_uri'))
        || voices.find(v => v.name.includes('Ava') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Jenny') || v.name.includes('Google US English') || v.name.includes('Karen'))
        || voices.find(v => v.lang.startsWith('en'))
        || voices[0];

      if (preferredVoice) utterance.voice = preferredVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  const playElegantChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // Soft ambient glass chime (C-major 7th chord triad with exponential decay)
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08 / (idx + 1), now + idx * 0.04 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.65);
      });

      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 800);
    } catch (e) {
      console.log('Chime playback error:', e);
    }
  };

  const triggerVibration = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
    } catch (e) { }
  };

  const fireNativePushNotification = (title, message) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(title, {
            body: message,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: 'taskpulse-alert',
            renotify: true,
          });
        }
      });
    } else if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'taskpulse-alert',
        renotify: true,
      });
    }
  };

  const triggerAudioAlert = async (title, message) => {
    const pref = profile?.notification_preference || 'text_and_sound';
    const textToAnnounce = `${title}. ${message}`;

    // Always fire a native OS/browser push notification
    fireNativePushNotification(title, message);

    if (pref === 'voice') {
      triggerVibration();
      playElegantChime();
      setTimeout(() => {
        playHumanizedVoice(textToAnnounce);
      }, 250);
    } else if (pref === 'text_and_sound') {
      triggerVibration();
      playElegantChime();
    } else if (pref === 'sound') {
      playElegantChime();
    } else if (pref === 'vibrate') {
      triggerVibration();
    }
  };

  const markAllRead = () => {
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
      }))
    );
    setHasUnread(false);
  };

  const hideNav =
    location.pathname === '/login' ||
    location.pathname === '/profile-setup';

  const workspaceNav = [
    { path: '/', label: 'Dashboard', icon: LayoutGrid },
    { path: '/schedule', label: 'Schedule & Timeline', icon: Calendar },
    { path: '/tasks', label: 'Tasks & Projects', icon: CheckSquare },
    { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  ];

  const systemNav = [
    { path: '/integrations', label: 'Integrations', icon: Link },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  const mobileNavItems = [
    { path: '/', label: 'Dashboard', icon: LayoutGrid },
    { path: '/tasks', label: 'Tasks', icon: CheckSquare },
    { path: '/schedule', label: 'Schedule', icon: Calendar },
    { path: '/profile', label: 'Profile', icon: User },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActivePath = (path) =>
    location.pathname === path ||
    (path !== '/' && location.pathname.startsWith(path));

  const getInitial = () =>
    profile?.name?.charAt(0)?.toUpperCase() || 'U';

  const handleLogout = () => {
    setShowUserMenu(false);
    setShowNotifMenu(false);
    logout();
    navigate('/login');
  };

  if (hideNav) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)]">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)] flex">

      {/* ── Toast Stack (top-right, stacked) ─────────────────────────── */}
      <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 max-w-[360px] w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-4 duration-300 ${
              toast.urgent
                ? 'bg-red-950/95 border-red-500/40 text-white'
                : 'bg-[var(--bg-panel)]/95 border-[var(--border-subtle)] text-[var(--text-main)]'
            }`}
            style={{ animation: 'slideInRight 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <div className="shrink-0 mt-0.5">
              {toast.urgent
                ? <AlertTriangle size={18} className="text-red-400" />
                : <Bell size={18} className="text-[var(--accent-base)]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-0.5">{toast.title}</p>
              <p className="text-sm leading-snug">{toast.message}</p>
              {toast.taskId && (
                <button
                  onClick={() => { navigate('/tasks'); dismissToast(toast.id); }}
                  className="mt-1.5 text-xs font-semibold text-[var(--accent-base)] hover:underline"
                >
                  View Task →
                </button>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5"
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Fixed Task "NOW" Banner ───────────────────────────────────── */}
      {activeFixedBanner && (
        <div className="fixed top-0 left-0 right-0 z-[99998] bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 text-white shadow-xl">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2.5 gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
                <Clock size={14} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold opacity-80 uppercase tracking-wide">Scheduled Task — Time Now</p>
                <p className="text-sm font-bold leading-tight">
                  ⚡ Complete your task: <span className="underline underline-offset-2">{activeFixedBanner.name}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  updateTask(activeFixedBanner.id, { status: 'completed' });
                  setActiveFixedBanner(null);
                }}
                className="flex items-center gap-1.5 bg-white text-purple-800 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <CheckCircle2 size={13} /> Mark Complete
              </button>
              <button
                onClick={() => navigate('/tasks')}
                className="text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                View Task
              </button>
              <button
                onClick={() => setActiveFixedBanner(null)}
                className="opacity-60 hover:opacity-100 ml-1"
              >
                <XIcon size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overdue Task Triage Banner (bottom) ──────────────────────────── */}
      {overdueTasks.length > 0 && !showTriagePanel && (
        <div
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 left-4 z-[99990] pointer-events-auto"
          style={{ animation: 'slideInRight 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <button
            onClick={() => setShowTriagePanel(true)}
            className="flex items-center gap-2.5 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl shadow-2xl font-semibold text-sm transition-all hover:scale-105"
          >
            <div className="relative">
              <ListTodo size={17} />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-400 rounded-full text-[10px] font-bold flex items-center justify-center">
                {overdueTasks.length}
              </span>
            </div>
            {overdueTasks.length === 1 ? '1 Overdue Task' : `${overdueTasks.length} Overdue Tasks`} — Review
          </button>
        </div>
      )}

      {/* ── Overdue Task Triage Panel (slide-up modal) ──────────────────── */}
      {showTriagePanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[99991] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTriagePanel(false)}
          />
          {/* Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[99992] bg-[var(--bg-panel)] rounded-t-2xl shadow-2xl border-t border-[var(--border-subtle)] max-h-[80vh] overflow-hidden flex flex-col"
            style={{ animation: 'slideUpPanel 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-orange-600" />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--text-main)] text-base leading-tight">Overdue Tasks</h2>
                  <p className="text-xs text-[var(--text-muted)]">{overdueTasks.length} task{overdueTasks.length > 1 ? 's' : ''} past deadline — take action</p>
                </div>
              </div>
              <button
                onClick={() => setShowTriagePanel(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Task list */}
            <div className="overflow-y-auto flex-1 px-5 py-3 flex flex-col gap-3">
              {overdueTasks.map(task => {
                const overdueByMs = Date.now() - new Date(task.deadline).getTime();
                const overdueHrs = Math.floor(overdueByMs / 3600000);
                const overdueDays = Math.floor(overdueHrs / 24);
                const overdueLabel = overdueDays > 0
                  ? `${overdueDays}d ${overdueHrs % 24}h overdue`
                  : `${overdueHrs}h overdue`;

                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-xl px-4 py-3"
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-main)] truncate">{task.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                          <AlertTriangle size={9} /> {overdueLabel}
                        </span>
                        {task.priority > 2 && (
                          <span className="inline-flex text-[11px] font-medium text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                            High Priority
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        title="Reschedule to tomorrow"
                        onClick={() => rescheduleTask(task)}
                        className="flex items-center gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <RotateCcw size={11} /> Reschedule
                      </button>
                      <button
                        title="Mark as completed"
                        onClick={() => {
                          updateTask(task.id, { status: 'completed' });
                          dismissOverdueTask(task.id);
                        }}
                        className="flex items-center gap-1 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <CheckCircle2 size={11} /> Done
                      </button>
                      <button
                        title="Dismiss"
                        onClick={() => dismissOverdueTask(task.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--border-subtle)] text-[var(--text-muted)] transition-colors"
                      >
                        <XIcon size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  overdueTasks.forEach(t => rescheduleTask(t));
                }}
                className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
              >
                <RotateCcw size={14} /> Reschedule All
              </button>
              <button
                onClick={() => {
                  overdueTasks.forEach(t => {
                    updateTask(t.id, { status: 'completed' });
                    dismissOverdueTask(t.id);
                  });
                  setShowTriagePanel(false);
                }}
                className="flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:underline"
              >
                <CheckCircle2 size={14} /> Mark All Done
              </button>
              <button
                onClick={() => setShowTriagePanel(false)}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
      {/* Desktop Sidebar */}
      <aside data-tour="sidebar-nav" className="hidden lg:flex w-64 flex-col bg-[var(--bg-app)] border-r border-[var(--border-subtle)] h-full shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-base)] flex items-center justify-center text-white shrink-0">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>

          <span className="font-bold text-lg leading-tight text-[var(--text-main)]">
            TaskPulse
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-8">
          <div>
            <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-2">
              Workspace
            </h3>

            <div className="flex flex-col gap-1">
              {workspaceNav.map((item) => {
                const isActive = isActivePath(item.path);
                const Icon = item.icon;

                return (
                  <button
                    key={item.path}
                    type="button"
                    data-tour={`nav-${item.path.slice(1) || 'dashboard'}`}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                      ? 'bg-[var(--accent-light)] text-[var(--accent-base)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'
                      }`}
                  >
                    <Icon
                      size={18}
                      className={
                        isActive ? 'stroke-[2.5px]' : 'stroke-2'
                      }
                    />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-2">
              System
            </h3>

            <div className="flex flex-col gap-1">
              {systemNav.map((item) => {
                const isActive = isActivePath(item.path);
                const Icon = item.icon;

                return (
                  <button
                    key={item.path}
                    type="button"
                    data-tour={`nav-${item.path.slice(1) || 'dashboard'}`}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                      ? 'bg-[var(--accent-light)] text-[var(--accent-base)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'
                      }`}
                  >
                    <Icon
                      size={18}
                      className={
                        isActive ? 'stroke-[2.5px]' : 'stroke-2'
                      }
                    />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border-subtle)]">
          <div className="bg-[var(--accent-base)]/5 dark:bg-[var(--accent-base)]/10 p-4 rounded-xl flex items-start gap-3 border border-[var(--accent-base)]/10 dark:border-[var(--accent-base)]/20">
            <Zap
              className="text-[var(--success-text)] shrink-0 mt-0.5"
              size={16}
            />

            <div>
              <h4 className="text-xs font-semibold text-[var(--text-main)] mb-1">
                Automation Engine
              </h4>

              <p className="text-[10px] text-[var(--text-muted)] leading-snug">
                All background schedules active with 99.8% precision.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] px-8 items-center justify-between shrink-0 z-40">
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                size={16}
              />

              <input
                type="text"
                placeholder="Search tasks, schedules, automations..."
                className="w-full bg-[var(--bg-hover)] border-none rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-[var(--accent-base)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-5 pl-4">
            <button
              type="button"
              className="btn-primary py-2 px-4 shadow-sm text-sm"
              onClick={() => navigate('/tasks')}
            >
              + New Task
            </button>

            {/* Notifications */}
            <div className="relative" data-notif-menu>
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={showNotifMenu}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors relative"
                onClick={() => {
                  window.dispatchEvent(new Event('close_chat'));
                  setShowNotifMenu((prev) => !prev);
                  setShowUserMenu(false);
                }}
              >
                <Bell size={20} />

                {(hasUnread || readinessScore < 100) && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--priority-critical)] rounded-full border-2 border-white" />
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 top-10 w-80 max-w-[90vw] bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <p className="font-semibold text-sm text-[var(--text-main)]">
                      Notifications
                    </p>

                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs text-[var(--accent-base)] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 cursor-pointer ${notification.read
                            ? ''
                            : 'bg-[var(--bg-hover)]'
                            }`}
                          onClick={() => setShowNotifMenu(false)}
                        >
                          <p className="text-sm font-semibold text-[var(--text-main)]">
                            {notification.title || 'Alert'}
                          </p>

                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {notification.message || ''}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-hover)] px-4 py-2 text-center">
                    <button 
                      onClick={() => {
                        setShowNotifMenu(false);
                        navigate('/notifications');
                      }}
                      className="text-sm font-medium text-[var(--accent-base)] hover:underline"
                    >
                      View all Reminders & Alerts
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop User Menu */}
            <div className="relative" data-user-menu data-tour="user-menu">
              <button
                type="button"
                aria-expanded={showUserMenu}
                onClick={() => {
                  window.dispatchEvent(new Event('close_chat'));
                  setShowUserMenu((prev) => !prev);
                  setShowNotifMenu(false);
                }}
                className="flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-hover)] rounded-lg px-2 py-1 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-[var(--border-subtle)]">
                  {profile?.picture ? (
                    <img
                      src={profile.picture}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                      {getInitial()}
                    </div>
                  )}
                </div>

                <ChevronDown
                  size={14}
                  className="text-[var(--text-muted)]"
                />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-12 w-56 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-50 py-2">
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                    <p className="font-bold text-sm text-[var(--text-main)] truncate">
                      {profile?.name || 'User'}
                    </p>

                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {profile?.email || ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/profile');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <User
                      size={15}
                      className="text-[var(--text-muted)]"
                    />
                    View Profile
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <Settings
                      size={15}
                      className="text-[var(--text-muted)]"
                    />
                    Settings
                  </button>

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(false);
                      localStorage.removeItem('taskpulse_tour_completed');
                      if (window.startTaskPulseTour) {
                        window.startTaskPulseTour();
                      } else {
                        window.dispatchEvent(new Event('start_user_tour'));
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(false);
                      localStorage.removeItem('taskpulse_tour_completed');
                      if (window.startTaskPulseTour) {
                        window.startTaskPulseTour();
                      } else {
                        window.dispatchEvent(new Event('start_user_tour'));
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer"
                  >
                    <HelpCircle
                      size={15}
                      className="text-indigo-500"
                    />
                    Replay User Guide
                  </button>

                  <div className="border-t border-[var(--border-subtle)] mt-1 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden px-5 py-4 flex items-center justify-between sticky top-0 bg-[var(--bg-panel)]/80 backdrop-blur-md z-40 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-base)] flex items-center justify-center text-white shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>

            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight text-[var(--text-main)]">
                TaskPulse
              </span>

              <span className="text-[10px] text-[var(--text-muted)] leading-tight capitalize">
                {location.pathname.slice(1) || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile Notifications */}
            <div className="relative" data-notif-menu>
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={showNotifMenu}
                onClick={() => {
                  window.dispatchEvent(new Event('close_chat'));
                  setShowNotifMenu((prev) => !prev);
                  setShowUserMenu(false);
                }}
                style={{ minHeight: 'unset' }}
                className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-main)] hover:text-[var(--accent-base)] hover:bg-[var(--bg-hover)] transition-colors relative"
              >
                <Bell size={20} />

                {(hasUnread || readinessScore < 100) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--priority-critical)] rounded-full border-2 border-white" />
                )}
              </button>

              {showNotifMenu && (
                <div className="fixed right-4 top-16 w-80 max-w-[calc(100vw-2rem)] bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-[9999] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <p className="font-semibold text-sm text-[var(--text-main)]">Notifications</p>
                    {notifications.length > 0 && (
                      <button type="button" onClick={markAllRead} style={{ minHeight: 'unset' }} className="text-xs text-[var(--accent-base)] hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">No notifications yet.</p>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 cursor-pointer ${notification.read ? '' : 'bg-[var(--bg-hover)]'}`}
                          onClick={() => setShowNotifMenu(false)}
                        >
                          <p className="text-sm font-semibold text-[var(--text-main)]">{notification.title || 'Alert'}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-1">{notification.message || ''}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-hover)] px-4 py-2 text-center">
                    <button
                      style={{ minHeight: 'unset' }}
                      onClick={() => { setShowNotifMenu(false); navigate('/notifications'); }}
                      className="text-sm font-medium text-[var(--accent-base)] hover:underline"
                    >
                      View all Reminders & Alerts
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile User Menu */}
            <div className="relative" data-user-menu data-tour="user-menu">
              <button
                type="button"
                aria-expanded={showUserMenu}
                aria-label="Open user menu"
                style={{ minHeight: 'unset' }}
                onClick={() => {
                  window.dispatchEvent(new Event('close_chat'));
                  setShowUserMenu((prev) => !prev);
                  setShowNotifMenu(false);
                }}
                className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden border border-[var(--border-subtle)] shrink-0"
              >
                {profile?.picture ? (
                  <img
                    src={profile.picture}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                    {getInitial()}
                  </div>
                )}
              </button>

              {showUserMenu && (
                <div className="fixed right-4 top-16 w-56 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-[9999] py-2">
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                    <p className="font-bold text-sm text-[var(--text-main)] truncate">
                      {profile?.name || 'User'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {profile?.email || ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    style={{ minHeight: 'unset' }}
                    onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                  >
                    <User size={15} />
                    Profile
                  </button>

                  <button
                    type="button"
                    style={{ minHeight: 'unset' }}
                    onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                  >
                    <Settings size={15} />
                    Settings
                  </button>

                  <button
                    type="button"
                    style={{ minHeight: 'unset' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(false);
                      localStorage.removeItem('taskpulse_tour_completed');
                      if (window.startTaskPulseTour) {
                        window.startTaskPulseTour();
                      } else {
                        window.dispatchEvent(new Event('start_user_tour'));
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(false);
                      localStorage.removeItem('taskpulse_tour_completed');
                      if (window.startTaskPulseTour) {
                        window.startTaskPulseTour();
                      } else {
                        window.dispatchEvent(new Event('start_user_tour'));
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-hover)] text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer"
                  >
                    <HelpCircle size={15} className="text-indigo-500" />
                    Replay User Guide
                  </button>

                  <div className="border-t border-[var(--border-subtle)] mt-1 pt-1">
                    <button
                      type="button"
                      style={{ minHeight: 'unset' }}
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative flex flex-col">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 w-full bg-[var(--bg-panel)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] px-6 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex justify-between items-center z-50">
          {mobileNavItems.map((item) => {
            const isActive = isActivePath(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                type="button"
                data-tour={`mob-nav-${item.path.slice(1) || 'dashboard'}`}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 ${isActive
                  ? 'text-[var(--accent-base)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
              >
                <Icon
                  size={22}
                  className={
                    isActive ? 'stroke-[2.5px]' : 'stroke-2'
                  }
                />
                <span className="text-[10px] font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <ChatButton />
        <UserGuideTour />
        <TaskAlarmManager />
      </div>
    </div>
  );
}
