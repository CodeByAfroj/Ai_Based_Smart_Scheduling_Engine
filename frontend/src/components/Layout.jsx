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
  Trash2,
  Sun,
  BellRing,
} from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import ChatButton from './ChatButton';
import UserGuideTour from './UserGuideTour';
import { syncTaskState } from '../utils/nativeBridge';

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
  
  const { tasks, updateTask } = useTasks();

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
  const [activeRescheduleTaskId, setActiveRescheduleTaskId] = useState(null);
  const [customDateTimeMap, setCustomDateTimeMap] = useState({});

  const { tasks, fetchTasks, updateTask, deleteTask } = useTasks();

  // Sync state from Native Distraction/Auto-Complete service
  useEffect(() => {
    const handleSync = () => {
      const nativeState = syncTaskState();
      Object.keys(nativeState).forEach(key => {
        if (key.startsWith('complete_task_') && nativeState[key]) {
          const taskId = key.replace('complete_task_', '');
          updateTask(taskId, { status: 'completed' });
        } else if (key.startsWith('undo_task_') && nativeState[key]) {
          const taskId = key.replace('undo_task_', '');
          updateTask(taskId, { status: 'pending' });
        }
      });
    };
    
    // Check initially and whenever window gains focus
    handleSync();
    window.addEventListener('focus', handleSync);
    return () => window.removeEventListener('focus', handleSync);
  }, [updateTask]);

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

  // ── Audio Context & Alarm Engine Initialization ───────────────────────────
  useEffect(() => {
    const initAudio = () => {
      if (!window.__audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          window.__audioCtx = new AudioContext();
        }
      }
      if (window.__audioCtx && window.__audioCtx.state === 'suspended') {
        window.__audioCtx.resume();
      }

      // Pre-unlock physical alarm audio element for Chrome/Safari autoplay policies
      if (!window.__alarmAudio) {
        const audio = new Audio('/alarm.mp3');
        audio.volume = 1.0;
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          window.__alarmAudio = audio;
          console.log('🔊 Alarm audio engine unlocked for device');
        }).catch(() => {
          window.__alarmAudio = audio;
        });
      }
    };

    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });

    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);

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

  // ── Reschedule Handlers (Interactive Choice Menu) ──────────────────────
  const dismissOverdueTask = (id) => {
    setDismissedOverdueIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('tp_dismissed_overdue', JSON.stringify([...next]));
      return next;
    });
    setOverdueTasks(prev => prev.filter(t => t.id !== id));
  };

  // Option 1: AI Auto-Fit Slot (Calls CP-SAT Solver)
  const handleAiAutoFit = async (task) => {
    try {
      pushToast({ title: 'Running AI Solver', message: `Calculating optimal focus slot for "${task.name}"...`, urgent: false });
      const newStart = new Date().toISOString();
      await updateTask(task.id, { status: 'pending', earliest_start: newStart });

      const res = await fetch(`${API_BASE}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tasks: [], fixed_events: [], reference_time: newStart })
      });
      if (res.ok) {
        if (fetchTasks) await fetchTasks(true);
        pushToast({ title: 'AI Auto-Scheduled', message: `"${task.name}" auto-fitted into your optimal focus window.`, urgent: false });
      }
    } catch (err) {
      console.warn('AI reschedule error', err);
    } finally {
      dismissOverdueTask(task.id);
      setActiveRescheduleTaskId(null);
    }
  };

  // Option 2: Push +2 Hours Today
  const handlePushHours = async (task, hours = 2) => {
    const now = Date.now();
    const newStart = new Date(now + 15 * 60 * 1000).toISOString();
    const newDeadline = new Date(now + hours * 60 * 60 * 1000).toISOString();
    await updateTask(task.id, { earliest_start: newStart, deadline: newDeadline, status: 'pending' });
    dismissOverdueTask(task.id);
    setActiveRescheduleTaskId(null);
    pushToast({ title: 'Pushed +2 Hours', message: `"${task.name}" start window extended today.`, urgent: false });
  };

  // Option 3: Tomorrow Morning (9:00 AM)
  const handleTomorrowMorning = async (task) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000);

    await updateTask(task.id, {
      earliest_start: tomorrow.toISOString(),
      deadline: tomorrowEnd.toISOString(),
      status: 'pending'
    });
    dismissOverdueTask(task.id);
    setActiveRescheduleTaskId(null);
    pushToast({ title: 'Tomorrow Morning', message: `"${task.name}" scheduled for 9:00 AM tomorrow.`, urgent: false });
  };

  // Option 4: Custom Date & Time
  const handleCustomReschedule = async (task, localDateTimeVal) => {
    if (!localDateTimeVal) return;
    const targetDate = new Date(localDateTimeVal);
    const earliestStart = new Date().toISOString();

    await updateTask(task.id, {
      earliest_start: earliestStart,
      deadline: targetDate.toISOString(),
      status: 'pending'
    });
    dismissOverdueTask(task.id);
    setActiveRescheduleTaskId(null);
    pushToast({ title: 'Custom Rescheduled', message: `"${task.name}" deadline updated.`, urgent: false });
  };

  const handleRescheduleAllAi = async () => {
    try {
      pushToast({ title: 'Auto-Scheduling All', message: `Optimizing ${overdueTasks.length} overdue tasks...`, urgent: false });
      const res = await fetch(`${API_BASE}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tasks: [], fixed_events: [], reference_time: new Date().toISOString() })
      });
      if (res.ok && fetchTasks) {
        await fetchTasks(true);
      }
    } catch (e) {
      console.warn('Bulk reschedule error', e);
    } finally {
      overdueTasks.forEach(t => dismissOverdueTask(t.id));
      setShowTriagePanel(false);
    }
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

  // Auto-subscribe to Web Push Notifications on login/load if permission is granted
  useEffect(() => {
    if (!token || !API_BASE) return;

    const setupWebPush = async () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted') {
        try {
          let registration = await navigator.serviceWorker.getRegistration();
          if (!registration) {
            registration = await navigator.serviceWorker.register('/push-sw.js');
          }
          registration = await navigator.serviceWorker.ready;

          const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          if (!vapidPublicKey) return;

          // urlBase64ToUint8Array logic inline
          const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
          const base64 = (vapidPublicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }

          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: outputArray
            });
          }

          // Send the active subscription to backend to ensure it's registered for this device
          await fetch(`${API_BASE}/notifications/subscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(subscription.toJSON())
          });
        } catch (err) {
          console.error('Auto-setup for push notifications failed:', err);
        }
      }
    };

    setupWebPush();
  }, [token, API_BASE]);

  // Active playing alarm banner (shows when push alarm arrives with Cancel button)
  const [activeAlarm, setActiveAlarm] = useState(null);

  const stopAlarm = useCallback(() => {
    if (window.__activeAlarmAudio) {
      window.__activeAlarmAudio.pause();
      window.__activeAlarmAudio.currentTime = 0;
    }
    if (window.__alarmTimeout) clearTimeout(window.__alarmTimeout);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setActiveAlarm(null);
  }, []);

  // Unlock browser audio permissions on first user click/touch gesture
  useEffect(() => {
    const unlockAudio = () => {
      if (window.__audioCtx && window.__audioCtx.state === 'suspended') {
        window.__audioCtx.resume().catch(() => {});
      }
      if (!window.__activeAlarmAudio) {
        try {
          window.__activeAlarmAudio = new Audio('/alarm.mp3');
          window.__activeAlarmAudio.volume = 1.0;
        } catch (_) {}
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Trigger Samsung alarm.mp3 audio playback and voice TTS when push alarm signal arrives
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleSWMessage = (event) => {
        if (!event.data) return;

        if (event.data.type === 'STOP_ALARM') {
          stopAlarm();
          return;
        }

        if (event.data.type === 'PLAY_ALARM') {
          const pref = event.data.notification_preference || 'text_and_sound';
          
          if (pref === 'silent' || pref === 'vibrate') {
            return;
          }

          setActiveAlarm({
            title: event.data.title || '🚨 DEADLINE ALARM',
            body: event.data.body || 'Your scheduled task focus window has arrived!'
          });

          if (pref === 'voice' && 'speechSynthesis' in window) {
            try {
              const text = `${event.data.title || 'Task Alert'}. ${event.data.body || ''}`;
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.rate = 1.0;
              utterance.pitch = 1.0;
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(utterance);
            } catch (err) {
              console.warn("TTS Error:", err);
            }
          }

          try {
            if (!window.__activeAlarmAudio) {
              window.__activeAlarmAudio = new Audio('/alarm.mp3');
            }
            window.__activeAlarmAudio.currentTime = 0;
            window.__activeAlarmAudio.volume = 1.0;
            window.__activeAlarmAudio.loop = true;
            window.__activeAlarmAudio.play().catch(e => console.warn('Autoplay block:', e));

            if (window.__alarmTimeout) clearTimeout(window.__alarmTimeout);
            window.__alarmTimeout = setTimeout(() => {
              if (window.__activeAlarmAudio) {
                window.__activeAlarmAudio.pause();
                window.__activeAlarmAudio.currentTime = 0;
              }
            }, 6000);
          } catch (e) {}
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSWMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      };
    }
  }, [stopAlarm]);

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
                try { localStorage.setItem('tp_notified_ids', JSON.stringify([...notifiedIdsRef.current])); } catch (_) { }
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

    // Poll every 15 seconds as a fallback
    const intervalId = setInterval(fetchNotifications, 15000);

    // Establish Server-Sent Events (SSE) connection for real-time push
    const eventSource = new EventSource(`${API_BASE}/notifications/stream?token=${token}`);

    eventSource.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse(e.data);
        // Show real-time alert toast & sound
        triggerAudioAlert(data.title || 'Alert', data.message || '');
        setHasUnread(true);
        // Fetch to update the notifications list menu
        fetchNotifications();
      } catch (err) {
        console.error('Error parsing real-time notification data:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.error('SSE Connection Error:', err);
    };

    return () => {
      clearInterval(intervalId);
      eventSource.close();
    };
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
          { key: '1440', mins: 1440, label: '24 hours', urgent: false },
          { key: '120', mins: 120, label: '2 hours', urgent: true },
          { key: '30', mins: 30, label: '30 minutes', urgent: true },
          { key: '0', mins: 0, label: 'RIGHT NOW', urgent: true },
        ];

        thresholds.forEach(({ key, mins, label, urgent }) => {
          const alertKey = `${task.id}:${key}`;
          // Fire when minutesLeft crosses from above to at-or-below threshold
          if (minutesLeft <= mins + 2 && minutesLeft >= mins - 2 && !deadlineAlertedRef.current.has(alertKey)) {
            deadlineAlertedRef.current.add(alertKey);
            // Persist so alerts don't re-fire after page refresh
            try { localStorage.setItem('tp_deadline_alerted', JSON.stringify([...deadlineAlertedRef.current])); } catch (_) { }

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
          const endMs = task.deadline ? new Date(task.deadline).getTime() : startMs + (task.duration_minutes || 60) * 60000;
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
      if (!window.__activeAlarmAudio) {
        window.__activeAlarmAudio = new Audio('/alarm.mp3');
      }
      window.__activeAlarmAudio.currentTime = 0;
      window.__activeAlarmAudio.volume = 1.0;
      window.__activeAlarmAudio.play().catch((err) => {
        console.warn("Audio play error:", err);
      });
    } catch (err) {
      console.warn("Audio exception:", err);
    }
  };

  const triggerVibration = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
    } catch (e) { }
  };

  const fireNativePushNotification = (title, message, isSilent = false) => {
    if (!('Notification' in window)) return;

    const options = {
      body: message,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'taskpulse-alert',
      renotify: true,
      silent: isSilent,
    };

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(title, options);
        }
      });
    } else if (Notification.permission === 'granted') {
      new Notification(title, options);
    }
  };

  const triggerAudioAlert = async (title, message) => {
    const pref = profile?.notification_preference || 'text_and_sound';
    const alarmEnabled = profile?.alarm_enabled !== false; // Default true
    const textToAnnounce = `${title}. ${message}`;

    // Always fire a native OS/browser push notification (pass silent flag if selected)
    fireNativePushNotification(title, message, pref === 'silent');

    if (!alarmEnabled) return;

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
      <div className="fixed inset-0 bg-[var(--bg-app)] text-[var(--text-main)] overflow-y-auto">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)] flex">

      {/* ── Toast Stack & Active Alarm (Dynamic Island Style) ─────────────────────────── */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-2 w-[92vw] max-w-[420px] pointer-events-none">
        
        {/* Dynamic Island Active Ringtone Alarm Pill */}
        {activeAlarm && (
          <div
            className="relative pointer-events-auto flex items-center gap-3 px-3.5 py-2.5 rounded-[28px] shadow-[0_15px_30px_-10px_rgba(0,0,0,0.8)] border border-red-500/40 bg-black/90 backdrop-blur-2xl text-white shadow-red-500/20 transition-all w-full overflow-hidden"
            style={{
              animation: 'dynamicIsland 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transformOrigin: 'top center'
            }}
          >
            {/* Dynamic Island Red Ambient Glow */}
            <div className="absolute -inset-4 opacity-25 blur-2xl rounded-full bg-red-500 pointer-events-none"></div>

            <div className="relative shrink-0 p-2 rounded-full bg-red-500/20 text-red-400 animate-pulse">
              <BellRing size={16} />
            </div>

            <div className="relative flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-[10px] font-black uppercase tracking-wider leading-none mb-0.5 text-red-400">
                {activeAlarm.title || '🚨 ALARM ACTIVE'}
              </p>
              <p className="text-[12px] text-slate-100 font-medium leading-tight truncate pr-1">
                {activeAlarm.body}
              </p>
            </div>

            <button
              onClick={stopAlarm}
              className="group relative shrink-0 flex items-center justify-center text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 shadow-md shadow-red-600/30 border border-red-400/30 active:scale-95 cursor-pointer"
              title="Cancel & Stop Alarm"
            >
              <XIcon size={13} /> Stop
            </button>
          </div>
        )}
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`relative pointer-events-auto flex items-center gap-3 px-3.5 py-2.5 rounded-[28px] shadow-[0_15px_30px_-10px_rgba(0,0,0,0.8)] border backdrop-blur-2xl transition-all w-full overflow-hidden ${toast.urgent
              ? 'bg-black/90 border-red-500/30 text-white shadow-red-500/20'
              : 'bg-black/90 border-white/10 text-white shadow-indigo-500/20'
              }`}
            style={{
              animation: 'dynamicIsland 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              transformOrigin: 'top center'
            }}
          >
            {/* Dynamic Island Ambient Glow */}
            <div className={`absolute -inset-4 opacity-15 blur-2xl rounded-full pointer-events-none ${toast.urgent ? 'bg-red-500' : 'bg-indigo-500'}`}></div>

            <div className={`relative shrink-0 p-1.5 rounded-full ${toast.urgent ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
              {toast.urgent ? <AlertTriangle size={16} /> : <Bell size={16} />}
            </div>

            <div className="relative flex-1 min-w-0 flex flex-col justify-center">
              <p className={`text-[10px] font-black uppercase tracking-wider leading-none mb-0.5 opacity-90 ${toast.urgent ? 'text-red-400' : 'text-slate-300'}`}>
                {toast.title}
              </p>
              <p className="text-[13px] text-slate-100 font-medium leading-tight truncate pr-2">{toast.message}</p>
            </div>

            {toast.taskId && (
              <button
                onClick={() => { navigate(`/tasks#task-${toast.taskId}`); dismissToast(toast.id); }}
                className="group relative shrink-0 flex items-center justify-center text-[10px] font-bold text-black bg-white hover:bg-slate-200 px-3 py-1.5 rounded-full transition-all"
              >
                View
              </button>
            )}

            <button
              onClick={() => dismissToast(toast.id)}
              className="relative shrink-0 p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/15 transition-all ml-1"
            >
              <XIcon size={12} />
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
                <p className="text-sm font-bold leading-tight flex items-center gap-1">
                  <Zap size={14} className="text-amber-300 shrink-0" />
                  <span>Complete your task: <span className="underline underline-offset-2">{activeFixedBanner.name}</span></span>
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

      {/* ── Overdue Task Triage Banner (bottom launcher button) ──────────────── */}
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

      {/* ── Overdue Task Triage Modal ──────────────────── */}
      {showTriagePanel && (
        <>
          {/* Backdrop (z-[100000] covers FAB cleanly when open) */}
          <div
            className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowTriagePanel(false);
              setActiveRescheduleTaskId(null);
            }}
          />
          {/* Modal Container */}
          <div
            className="fixed bottom-0 sm:bottom-6 left-0 right-0 sm:left-4 sm:right-4 z-[100001] bg-[var(--bg-panel)] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[var(--border-subtle)] max-h-[85vh] sm:max-h-[80vh] w-full sm:max-w-2xl sm:mx-auto flex flex-col overflow-hidden"
            style={{ animation: 'slideUpPanel 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-orange-400" />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--text-main)] text-base leading-tight">Overdue Tasks</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{overdueTasks.length} task{overdueTasks.length > 1 ? 's' : ''} past deadline — choose action</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTriagePanel(false);
                  setActiveRescheduleTaskId(null);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Task list */}
            <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-3 flex flex-col gap-3">
              {overdueTasks.map(task => {
                const overdueByMs = Date.now() - new Date(task.deadline).getTime();
                const overdueHrs = Math.floor(overdueByMs / 3600000);
                const overdueDays = Math.floor(overdueHrs / 24);
                const overdueLabel = overdueDays > 0
                  ? `${overdueDays}d ${overdueHrs % 24}h overdue`
                  : `${overdueHrs}h overdue`;
                const isMenuOpen = activeRescheduleTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm hover:border-[var(--border-main)] transition-colors"
                  >
                    {/* Top Row: Info & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left side: Task Title & Badges */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--text-main)] truncate leading-tight">
                          {task.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-md">
                            <AlertTriangle size={11} className="text-red-400 shrink-0" />
                            {overdueLabel}
                          </span>
                          {task.priority > 2 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                              High Priority
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side: Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        <button
                          title="Reschedule options"
                          onClick={() => setActiveRescheduleTaskId(isMenuOpen ? null : task.id)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${isMenuOpen
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20'
                            }`}
                        >
                          <RotateCcw size={12} />
                          <span>Reschedule</span>
                          <ChevronDown size={12} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                          title="Mark as completed"
                          onClick={() => {
                            updateTask(task.id, { status: 'completed' });
                            dismissOverdueTask(task.id);
                          }}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                        >
                          <CheckCircle2 size={12} />
                          <span>Done</span>
                        </button>

                        <button
                          title="Delete task"
                          onClick={async () => {
                            if (deleteTask) await deleteTask(task.id);
                            dismissOverdueTask(task.id);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>

                        <button
                          title="Dismiss notification"
                          onClick={() => dismissOverdueTask(task.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Interactive Choice Menu Dropdown */}
                    {isMenuOpen && (
                      <div className="mt-1 pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                          Select Reschedule Option
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {/* Option 1: AI Auto-Fit */}
                          <button
                            onClick={() => handleAiAutoFit(task)}
                            className="flex items-start gap-2.5 p-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/15 transition-all text-left group cursor-pointer"
                          >
                            <Zap size={15} className="text-indigo-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-xs font-bold text-[var(--text-main)] group-hover:text-indigo-300">
                                AI Auto-Fit Slot
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                Optimal CP-SAT time block
                              </div>
                            </div>
                          </button>

                          {/* Option 2: Push +2 Hours */}
                          <button
                            onClick={() => handlePushHours(task, 2)}
                            className="flex items-start gap-2.5 p-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/15 transition-all text-left group cursor-pointer"
                          >
                            <Clock size={15} className="text-blue-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-xs font-bold text-[var(--text-main)] group-hover:text-blue-300">
                                Push +2 Hours
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                Later today
                              </div>
                            </div>
                          </button>

                          {/* Option 3: Tomorrow Morning */}
                          <button
                            onClick={() => handleTomorrowMorning(task)}
                            className="flex items-start gap-2.5 p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 transition-all text-left group cursor-pointer"
                          >
                            <Sun size={15} className="text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-xs font-bold text-[var(--text-main)] group-hover:text-amber-300">
                                Tomorrow Morning
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                At 9:00 AM
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* Custom Date & Time selector */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)]">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] shrink-0">
                            <Calendar size={14} className="text-emerald-400" />
                            <span>Custom Time:</span>
                          </div>
                          <input
                            type="datetime-local"
                            value={customDateTimeMap[task.id] || ''}
                            onChange={(e) => setCustomDateTimeMap(prev => ({ ...prev, [task.id]: e.target.value }))}
                            className="flex-1 bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-main)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 transition-colors"
                          />
                          <button
                            disabled={!customDateTimeMap[task.id]}
                            onClick={() => handleCustomReschedule(task, customDateTimeMap[task.id])}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs disabled:opacity-40 transition-colors shrink-0"
                          >
                            Set Time
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between gap-3 flex-wrap">
              <button
                onClick={handleRescheduleAllAi}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Zap size={14} /> AI Reschedule All
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    overdueTasks.forEach(t => {
                      updateTask(t.id, { status: 'completed' });
                      dismissOverdueTask(t.id);
                    });
                    setShowTriagePanel(false);
                  }}
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <CheckCircle2 size={14} /> Mark All Done
                </button>
                <button
                  onClick={() => setShowTriagePanel(false)}
                  className="text-xs sm:text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] px-2 py-1 rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Desktop Sidebar */}
      <aside data-tour="sidebar-nav" className="hidden lg:flex w-64 flex-col bg-[var(--bg-app)] border-r border-[var(--border-subtle)] h-full shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.1)] overflow-hidden border border-[var(--border-subtle)]">
            <img src="/logo.png" alt="TaskPulse Logo" className="w-full h-full object-cover" />
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
                <div className="absolute right-0 top-12 w-[340px] max-w-[90vw] bg-black/90 backdrop-blur-2xl border border-white/10 rounded-[28px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] z-50 overflow-hidden text-white animate-in slide-in-from-top-2 duration-300">
                  <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <p className="font-bold text-sm tracking-wide">
                      Notifications
                    </p>

                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-5 py-8 text-sm text-slate-400 text-center font-medium">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`px-4 py-3 border-b border-white/5 last:border-b-0 cursor-pointer transition-colors ${notification.read
                            ? 'hover:bg-white/5'
                            : 'bg-indigo-500/10 hover:bg-indigo-500/20'
                            }`}
                          onClick={() => setShowNotifMenu(false)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`shrink-0 mt-0.5 p-1.5 rounded-full ${!notification.read ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-400'}`}>
                              <Bell size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] font-black uppercase tracking-wider leading-none mb-1 opacity-90 ${!notification.read ? 'text-indigo-400' : 'text-slate-400'}`}>
                                {notification.title || 'Alert'}
                              </p>
                              <p className={`text-[12px] leading-snug truncate pr-2 ${!notification.read ? 'text-slate-100 font-medium' : 'text-slate-300'}`}>
                                {notification.message || ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-white/10 bg-white/5 px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        setShowNotifMenu(false);
                        navigate('/notifications');
                      }}
                      className="text-[12px] font-bold text-indigo-400 hover:text-white transition-colors"
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
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.1)] overflow-hidden border border-[var(--border-subtle)] shrink-0">
              <img src="/logo.png" alt="TaskPulse Logo" className="w-full h-full object-cover" />
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
                <div className="fixed right-4 top-16 w-[340px] max-w-[calc(100vw-2rem)] bg-[var(--bg-panel)] backdrop-blur-2xl border border-[var(--border-subtle)] rounded-[28px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] z-[9999] overflow-hidden text-[var(--text-main)] animate-in slide-in-from-top-2 duration-300">
                  <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-app)]/50">
                    <p className="font-bold text-sm tracking-wide">Notifications</p>
                    {notifications.length > 0 && (
                      <button type="button" onClick={markAllRead} style={{ minHeight: 'unset' }} className="text-[11px] font-semibold text-[var(--accent-base)] hover:opacity-80 transition-opacity uppercase tracking-wider">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-5 py-8 text-sm text-[var(--text-muted)] text-center font-medium">No notifications yet.</p>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 cursor-pointer transition-colors ${notification.read ? 'hover:bg-[var(--bg-hover)]' : 'bg-[var(--accent-light)] hover:bg-[var(--accent-hover)]/10'}`}
                          onClick={() => setShowNotifMenu(false)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`shrink-0 mt-0.5 p-1.5 rounded-full ${!notification.read ? 'bg-[var(--accent-base)] text-white' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'}`}>
                              <Bell size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] font-black uppercase tracking-wider leading-none mb-1 ${!notification.read ? 'text-[var(--accent-base)]' : 'text-[var(--text-muted)]'}`}>
                                {notification.title || 'Alert'}
                              </p>
                              <p className={`text-[12px] leading-snug truncate pr-2 ${!notification.read ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-muted)]'}`}>
                                {notification.message || ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/50 px-4 py-3 text-center">
                    <button
                      type="button"
                      style={{ minHeight: 'unset' }}
                      onClick={() => { setShowNotifMenu(false); navigate('/notifications'); }}
                      className="text-[12px] font-bold text-[var(--accent-base)] hover:opacity-80 transition-opacity"
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
        <main className="flex-1 overflow-y-auto relative block">
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
      </div>
    </div>
  );
}
