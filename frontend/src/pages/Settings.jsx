import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell, Moon, Sun, Monitor, Vibrate, Volume2, VolumeX,
  MessageSquare, Activity, Play, Square, AlertCircle, RefreshCw,
  Save, ChevronRight, Zap, CheckCircle2, Smartphone, Settings as SettingsIcon
} from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';

import { useTheme } from '../contexts/ThemeContext';
import { useLiveTracking } from '../contexts/TrackingContext';

// ── Helper ───────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Main Settings Page ────────────────────────────────────────────────────────
export default function Settings() {
  const { profile, token, API_BASE, fetchProfile } = useAuth();
  const navigate = useNavigate();

  const [notifPref, setNotifPref] = useState(profile?.notification_preference || 'text_and_sound');
  const [pushEnabled, setPushEnabled] = useState(profile?.push_notifications ?? true);
  const [alarmEnabled, setAlarmEnabled] = useState(profile?.alarm_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { theme, applyTheme } = useTheme();
  const { tracking, error: trackError, status: trackStatus, toggle: toggleTracking } = useLiveTracking();

  const notifOptions = [
    { id: 'voice',         icon: Volume2,       label: 'Neural AI Voice',     desc: 'Humanized TTS reads alerts aloud via edge-tts',        color: 'indigo' },
    { id: 'text_and_sound',icon: MessageSquare,  label: 'Text + Sound Chime',  desc: 'Popup notification with a glass chime tone',           color: 'blue'   },
    { id: 'sound',         icon: Volume2,        label: 'Sound Only',          desc: 'Plays chime without popup or voice',                    color: 'emerald'},
    { id: 'vibrate',       icon: Vibrate,        label: 'Vibrate / Haptic',    desc: 'Silent phone vibration pattern, no sound',             color: 'amber'  },
    { id: 'silent',        icon: VolumeX,        label: 'Silent / Visual Only',desc: 'In-app badge only, no sound or haptic',                color: 'slate'  },
  ];

  const themeOptions = [
    { id: 'light',  icon: Sun,     label: 'Light'  },
    { id: 'dark',   icon: Moon,    label: 'Dark'   },
    { id: 'system', icon: Monitor, label: 'System' },
  ];

  const colorMap = {
    indigo:  { sel: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/50',  icon: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'   },
    blue:    { sel: 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/50',      icon: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'       },
    emerald: { sel: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/50',icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
    amber:   { sel: 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/50',    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'     },
    slate:   { sel: 'border-slate-400 bg-slate-50 dark:bg-slate-500/10 dark:border-slate-500/50',    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400'     },
  };

  const saveNotif = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/profile/update`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, notification_preference: notifPref, push_notifications: pushEnabled, alarm_enabled: alarmEnabled }),
      });
      await fetchProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async () => {
    const newVal = !pushEnabled;
    setPushEnabled(newVal);
    
    if (newVal && 'Notification' in window && 'serviceWorker' in navigator) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Ensure SW is registered
          let registration = await navigator.serviceWorker.getRegistration();
          if (!registration) {
             registration = await navigator.serviceWorker.register('/push-sw.js');
          }
          registration = await navigator.serviceWorker.ready;
          
          const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          
          if (!vapidPublicKey) {
            console.error("VAPID public key not found in env.");
            setPushEnabled(false);
            return;
          }
          
          const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
          
          let subscription = await registration.pushManager.getSubscription();
          if (subscription) {
              // Unsubscribe from the old key first to avoid VAPID mismatch
              await subscription.unsubscribe();
          }
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });
          
          // Send to backend
          await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/notifications/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(subscription)
          });
          
          console.log('Push subscription successful');
        } else {
          setPushEnabled(false);
          alert('Notification permission denied. Please enable in browser settings.');
        }
      } catch (err) {
        console.error('Failed to subscribe to push notifications:', err);
        setPushEnabled(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-5 lg:px-10 py-4 flex items-center gap-3">
        <div className="bg-white/10 rounded-lg p-2 shrink-0">
          <SettingsIcon size={18} />
        </div>
        <div>
          <h1 className="font-bold text-sm">App Settings</h1>
          <p className="text-white/60 text-xs">Theme, notifications, live tracking and app behaviour</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 pb-28 lg:pb-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6">
        {/* THEME */}
        <section data-tour="settings-theme" className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <Sun size={16} />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-main)] text-sm">Appearance & Theme</h2>
              <p className="text-xs text-[var(--text-muted)]">Choose how TaskPulse looks across all pages</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  style={{ minHeight: 'unset' }}
                  onClick={() => applyTheme(id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    theme === id
                      ? 'border-[var(--accent-base)] bg-[var(--accent-light)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-app)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <Icon size={22} className={theme === id ? 'text-[var(--accent-base)]' : 'text-[var(--text-muted)]'} />
                  <span className={`text-xs font-bold ${theme === id ? 'text-[var(--accent-base)]' : 'text-[var(--text-muted)]'}`}>
                    {label}
                  </span>
                  {theme === id && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-base)]" />}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-3 text-center">
              Theme applies immediately and persists across sessions.
            </p>
          </div>
        </section>

        {/* NOTIFICATIONS */}
        <section data-tour="settings-notif" className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Bell size={16} />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-main)] text-sm">Notification Preferences</h2>
              <p className="text-xs text-[var(--text-muted)]">How you receive task alerts and schedule reminders</p>
            </div>
          </div>
          <div className="px-6 py-5 flex flex-col gap-5">
            {/* Push toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Smartphone size={15} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[var(--text-main)]">Push Notifications</p>
                  <p className="text-xs text-[var(--text-muted)]">Alerts for reminders and schedule changes</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={pushEnabled} onChange={(e) => handlePushToggle(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Alarm toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <Bell size={15} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[var(--text-main)]">In-App Web Alarms</p>
                  <p className="text-xs text-[var(--text-muted)]">Play sound locally when website is open</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={alarmEnabled} onChange={(e) => setAlarmEnabled(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {/* Alert mode */}
            <div>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Alert Delivery Mode</p>
              <div className="flex flex-col gap-2">
                {notifOptions.map(({ id, icon: Icon, label, desc, color }) => {
                  const isSelected = notifPref === id;
                  const c = colorMap[color];
                  return (
                    <button
                      key={id}
                      style={{ minHeight: 'unset' }}
                      onClick={() => setNotifPref(id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected ? c.sel : 'border-[var(--border-subtle)] bg-[var(--bg-app)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[var(--text-main)]">{label}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        isSelected ? 'border-[var(--accent-base)] bg-[var(--accent-base)]' : 'border-[var(--border-strong)]'
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save */}
            <button
              style={{ minHeight: 'unset' }}
              onClick={saveNotif}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                saved ? 'bg-emerald-500 text-white' : 'bg-[var(--accent-base)] text-white hover:bg-[var(--accent-hover)]'
              } disabled:opacity-60`}
            >
              {saved ? <><CheckCircle2 size={16} /> Saved!</> : saving ? 'Saving...' : <><Save size={16} /> Save Notification Settings</>}
            </button>
          </div>
        </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
        {/* LIVE TRACKING */}
        <section className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tracking ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'}`}>
              <Activity size={16} className={tracking ? 'animate-pulse' : ''} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-[var(--text-main)] text-sm">Live Activity Tracking</h2>
              <p className="text-xs text-[var(--text-muted)]">Uses device motion to auto-reschedule when you're busy</p>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${tracking ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {tracking ? '● Live' : 'Off'}
            </span>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            {/* How it works */}
            <div className="bg-[var(--bg-app)] rounded-xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">How it works</p>
              <div className="flex flex-col gap-1.5">
                {[
                  'Reads accelerometer + gyroscope data every 2.5 seconds',
                  'Classifies your activity (walking, sitting, moving)',
                  'If detected as "busy", active tasks are auto-shifted forward',
                  'No raw sensor data stored — only the activity classification label',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-[var(--text-muted)]">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {trackError && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold">
                <AlertCircle size={14} /> {trackError}
              </div>
            )}

            {tracking && trackStatus && (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${trackStatus.busy ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className={`w-3 h-3 rounded-full shrink-0 ${trackStatus.busy ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                <div>
                  <p className={`font-bold text-sm capitalize ${trackStatus.busy ? 'text-red-700' : 'text-green-700'}`}>
                    {trackStatus.activity} — {trackStatus.busy ? 'Busy (auto-shifting tasks)' : 'Free'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">Confidence: {Math.round((trackStatus.confidence || 0) * 100)}%</p>
                </div>
              </div>
            )}

            {tracking && !trackStatus && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs">
                <RefreshCw size={13} className="animate-spin" /> Analyzing motion data...
              </div>
            )}

            <button
              style={{ minHeight: 'unset' }}
              onClick={toggleTracking}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all ${
                tracking
                  ? 'bg-slate-800 text-white hover:bg-slate-700'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 shadow-md'
              }`}
            >
              {tracking ? <><Square size={15} fill="currentColor" /> Stop Live Tracking</> : <><Play size={15} fill="currentColor" /> Enable Live Tracking</>}
            </button>
            <p className="text-[11px] text-[var(--text-muted)] text-center">
              Requires device motion sensor access. iOS 13+ will prompt for permission.
            </p>
          </div>
        </section>

        {/* QUICK LINKS */}
        <section className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="font-bold text-[var(--text-main)] text-sm">More Configuration</h2>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {[
              { label: 'Work Hours & Scheduling Rules', sub: 'Timezone, work window, chronotype, breaks', path: '/profile-setup', icon: Zap, cls: 'text-amber-600 bg-amber-100' },
              { label: 'Integrations', sub: 'Google Calendar, Outlook, API keys', path: '/integrations', icon: SettingsIcon, cls: 'text-blue-600 bg-blue-100' },
              { label: 'Notification History', sub: 'View all past alerts and reminders', path: '/notifications', icon: Bell, cls: 'text-purple-600 bg-purple-100' },
            ].map(({ label, sub, path, icon: Icon, cls }) => (
              <button
                key={path}
                style={{ minHeight: 'unset' }}
                onClick={() => navigate(path)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-hover)] transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text-main)]">{label}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{sub}</p>
                </div>
                <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
              </button>
            ))}
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
