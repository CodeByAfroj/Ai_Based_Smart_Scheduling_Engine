import { useEffect, useState, useRef } from 'react';
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
} from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatButton from './ChatButton';

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

  const notifiedIdsRef = useRef(new Set());
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close menus when clicking/tapping anywhere outside — works on all screen sizes
  useEffect(() => {
    const handleOutsideClick = (e) => {
      const clickedInsideNotif = notifRef.current?.contains(e.target);
      const clickedInsideUser = userMenuRef.current?.contains(e.target);
      if (!clickedInsideNotif) setShowNotifMenu(false);
      if (!clickedInsideUser) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
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
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-[var(--bg-app)] border-r border-[var(--border-subtle)] h-screen sticky top-0 shrink-0">
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
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] px-8 items-center justify-between sticky top-0 z-40">
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
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={showNotifMenu}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors relative"
                onClick={() => {
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
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                aria-expanded={showUserMenu}
                onClick={() => {
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
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={showNotifMenu}
                onClick={() => {
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
            <div className="relative">
              <button
                type="button"
                aria-expanded={showUserMenu}
                aria-label="Open user menu"
                style={{ minHeight: 'unset' }}
                onClick={() => {
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
        <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 relative flex flex-col">
          {readinessScore < 100 && location.pathname !== '/profile-setup' && (
            <div className="bg-amber-500 text-white px-4 py-2.5 text-center text-sm font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 z-30 sticky top-0 shadow-sm">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={16} />
                <span>Please complete your profile setup.</span>
              </div>
              <button
                onClick={() => navigate('/profile-setup')}
                className="underline hover:text-amber-100 transition-colors"
              >
                Set up now
              </button>
            </div>
          )}
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
      </div>
    </div>
  );
}
