import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell, Moon, Sun, Monitor, Vibrate, Volume2, VolumeX,
  MessageSquare, Activity, Play, Square, AlertCircle, RefreshCw,
  ChevronRight, Zap, Smartphone, Settings as SettingsIcon, CheckCircle2,
  Clock, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLiveTracking } from '../contexts/TrackingContext';
import {
  isTWA,
  checkScreenTimePermission,
  requestScreenTimePermission,
  checkExactAlarmPermission,
  requestExactAlarmPermission,
  getScreenTimeUsageData,
  getMonitorDebugLogs,
  clearMonitorDebugLogs
} from '../utils/nativeBridge';

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

import { Section, Row } from '../components/ui/LayoutBlocks';

const Toggle = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
    <div className="w-[50px] h-[30px] bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[20px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-[26px] after:w-[26px] after:transition-all after:shadow-sm peer-checked:bg-green-500 dark:peer-checked:bg-green-500"></div>
  </label>
);

export default function Settings() {
  const { profile, token, API_BASE, fetchProfile } = useAuth();
  const navigate = useNavigate();

  const [notifPref, setNotifPref] = useState(profile?.notification_preference || 'text_and_sound');
  const [pushEnabled, setPushEnabled] = useState(profile?.push_notifications ?? true);
  const [alarmEnabled, setAlarmEnabled] = useState(profile?.alarm_enabled ?? true);

  const [screenTimePerm, setScreenTimePerm] = useState(false);
  const [exactAlarmPerm, setExactAlarmPerm] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [nativeVersion, setNativeVersion] = useState("Web");
  const [screenTimeData, setScreenTimeData] = useState(null);
  const [isRefreshingScreenTime, setIsRefreshingScreenTime] = useState(false);
  const [debugLogs, setDebugLogs] = useState("");

  useEffect(() => {
    // Poll logs every 1s when Settings is open
    let intervalId;
    if (isNativeApp) {
      intervalId = setInterval(() => {
        setDebugLogs(getMonitorDebugLogs());
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isNativeApp]);

  useEffect(() => {
    const native = isTWA();
    setIsNativeApp(native);

    if (native && window.AndroidNative && window.AndroidNative.getNativeVersion) {
      setNativeVersion(window.AndroidNative.getNativeVersion());
    }

    async function initPermissions() {
      const stPerm = await checkScreenTimePermission();
      const eaPerm = await checkExactAlarmPermission();
      setScreenTimePerm(stPerm);
      setExactAlarmPerm(eaPerm);

      // Auto-prompt browser notification permission on PWA (non-native)
      if (!native && 'Notification' in window && Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result === 'granted') setExactAlarmPerm(true);
      }
    }
    initPermissions();

    // Re-check permissions when user returns from Android settings
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const stPerm = await checkScreenTimePermission();
        const eaPerm = await checkExactAlarmPermission();
        setScreenTimePerm(stPerm);
        setExactAlarmPerm(eaPerm);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleRequestScreenTime = async () => {
    await requestScreenTimePermission();
    // Permission is granted in Android settings, re-check on return (handled by visibilitychange)
  };

  const handleRequestExactAlarm = async () => {
    await requestExactAlarmPermission();
    // Permission is granted in Android settings, re-check on return (handled by visibilitychange)
  };

  useEffect(() => {
    if (profile) {
      if (profile.notification_preference) setNotifPref(profile.notification_preference);
      if (profile.push_notifications !== undefined) setPushEnabled(profile.push_notifications);
      if (profile.alarm_enabled !== undefined) setAlarmEnabled(profile.alarm_enabled);
    }
  }, [profile]);

  const { theme, applyTheme } = useTheme();
  const { tracking, error: trackError, status: trackStatus, toggle: toggleTracking } = useLiveTracking();

  const notifOptions = [
    { id: 'voice', icon: Volume2, label: 'Neural AI Voice', desc: 'Reads alerts aloud', color: 'bg-indigo-500' },
    { id: 'text_and_sound', icon: MessageSquare, label: 'Text + Sound Chime', desc: 'Popup with chime', color: 'bg-blue-500' },
    { id: 'sound', icon: Volume2, label: 'Sound Only', desc: 'Audio chime only', color: 'bg-emerald-500' },
    { id: 'vibrate', icon: Vibrate, label: 'Vibrate / Haptic', desc: 'Vibration pattern', color: 'bg-amber-500' },
    { id: 'silent', icon: VolumeX, label: 'Silent / Visual Only', desc: 'Silent badge only', color: 'bg-slate-500' },
  ];

  const handlePushToggle = async (val) => {
    setPushEnabled(val);
    saveNotifConfigs(notifPref, val, alarmEnabled);
    if (val && 'Notification' in window && 'serviceWorker' in navigator) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
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
          if (subscription) await subscription.unsubscribe();
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });

          // Send the push subscription to the backend
          await fetch(`${API_BASE}/notifications/subscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(subscription.toJSON())
          });
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

  const saveNotifConfigs = async (pref, push, alarm) => {
    try {
      await fetch(`${API_BASE}/profile/update`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, notification_preference: pref, push_notifications: push, alarm_enabled: alarm }),
      });
      await fetchProfile();
    } catch { /* silent */ }
  };

  const setAndSavePref = (pref) => {
    setNotifPref(pref);
    saveNotifConfigs(pref, pushEnabled, alarmEnabled);
  };

  const setAndSaveAlarm = (val) => {
    setAlarmEnabled(val);
    saveNotifConfigs(notifPref, pushEnabled, val);
  };

  return (
    <div className="bg-[var(--bg-app)] pb-24 lg:pb-12 pt-4 lg:pt-8 min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        <h1 className="text-3xl font-bold text-[var(--text-main)] mb-6">Settings</h1>

        {/* Appearance */}
        <div data-tour="settings-theme">
          <Section title="Appearance">
            <Row
              icon={Sun} iconColor="bg-amber-500" title="Light Mode"
              onClick={() => applyTheme('light')}
              right={theme === 'light' && <CheckCircle2 size={20} className="text-blue-500" />}
            />
            <Row
              icon={Moon} iconColor="bg-slate-800" title="Dark Mode"
              onClick={() => applyTheme('dark')}
              right={theme === 'dark' && <CheckCircle2 size={20} className="text-blue-500" />}
            />
            <Row
              icon={Monitor} iconColor="bg-blue-500" title="System Theme"
              onClick={() => applyTheme('system')}
              right={theme === 'system' && <CheckCircle2 size={20} className="text-blue-500" />}
            />
          </Section>
        </div>

        {/* Notifications */}
        <div data-tour="settings-notif">
          <Section title="Notifications">
            <Row
              icon={Smartphone} iconColor="bg-red-500" title="Push Notifications" subtitle="Distraction nudges and completion alerts"
              right={<Toggle checked={pushEnabled} onChange={handlePushToggle} />}
            />
            <Row
              icon={Bell} iconColor="bg-orange-500" title="Task Start Alarms" subtitle="Alarm triggered exactly at task start time"
              right={<Toggle checked={alarmEnabled} onChange={setAndSaveAlarm} />}
            />
          </Section>
        </div>

        {/* Device & Hardware Permissions */}
        <div data-tour="settings-hardware-permissions">
          <Section
            title="Device & System Permissions"
            footer={isNativeApp ? `Android Native App Mode active (v${nativeVersion}): Hardware alarms & system screen time access enabled.` : "Web PWA Mode active (Mac/Desktop): In-app focus tracking & browser audio alarms active."}
          >
            <Row
              icon={Activity}
              iconColor="bg-emerald-500"
              title="Analyze App Activity & Screen Time"
              subtitle={isNativeApp ? "Grants Android UsageStats access to analyze app activity" : "In-app focus & idle session analyzer (Web PWA)"}
              right={
                screenTimePerm ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Granted
                  </span>
                ) : (
                  <button
                    onClick={handleRequestScreenTime}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                  >
                    Grant Access
                  </button>
                )
              }
            />
            {isNativeApp && (
              <Row
                icon={Clock}
                iconColor="bg-indigo-500"
                title="Exact Hardware Clock Alarms"
                subtitle="Allows waking phone from sleep & ringing lock-screen alarms"
                right={
                  exactAlarmPerm ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 size={14} /> Granted
                    </span>
                  ) : (
                    <button
                      onClick={handleRequestExactAlarm}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                    >
                      Enable Alarms
                    </button>
                  )
                }
              />
            )}
          </Section>
        </div>



        {/* Alert Style */}
        <div data-tour="settings-alert-style">
          <Section title="Alert Style">
            {notifOptions.map((opt) => (
              <Row
                key={opt.id}
                icon={opt.icon} iconColor={opt.color}
                title={opt.label} subtitle={opt.desc}
                onClick={() => setAndSavePref(opt.id)}
                right={notifPref === opt.id && <CheckCircle2 size={20} className="text-blue-500" />}
              />
            ))}
          </Section>
        </div>

        {/* Live Activity Tracking */}
        <Section title="Live Tracking" footer="Uses device motion (accelerometer) to detect if you're busy and auto-reschedule active tasks. iOS requires Safari motion permissions.">
          <Row
            icon={Activity} iconColor="bg-green-500" title="Live Activity Tracking"
            right={<Toggle checked={tracking} onChange={toggleTracking} />}
          />
          {tracking && (
            <div className="px-4 py-3 bg-[var(--bg-app)] border-t border-[var(--border-subtle)] text-[13px]">
              {trackError ? (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle size={14} /> {trackError}
                </div>
              ) : trackStatus ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[var(--text-main)]">Current Status: </span>
                    <span className={trackStatus.busy ? 'text-orange-500 font-bold' : 'text-green-500 font-bold capitalize'}>
                      {trackStatus.activity}
                    </span>
                  </div>
                  <span className="text-[var(--text-muted)]">{(trackStatus.confidence * 100).toFixed(0)}% accuracy</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <RefreshCw size={14} className="animate-spin" /> Analyzing motion data...
                </div>
              )}
            </div>
          )}


        </Section>

        {/* Developer Console (Native Service Logs) */}
        {isNativeApp && (
          <Section title="Developer Console (Native Service)">
            <div className="p-4 bg-black rounded-b-2xl border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-mono">TaskMonitorService Logs</span>
                <button
                  onClick={() => {
                    clearMonitorDebugLogs();
                    setDebugLogs("");
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-mono flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Clear
                </button>
              </div>
              <div className="h-48 overflow-y-auto font-mono text-[10px] text-green-400 whitespace-pre-wrap break-words leading-tight custom-scrollbar">
                {debugLogs ? debugLogs : "Waiting for service logs..."}
              </div>
            </div>
          </Section>
        )}

        {/* Advanced & Configuration */}
        <Section title="Configuration">
          <Row
            icon={Zap} iconColor="bg-indigo-500" title="Work Hours & Rules"
            onClick={() => navigate('/profile-setup')}
            right={<ChevronRight size={20} className="text-slate-400" />}
          />
          <Row
            icon={SettingsIcon} iconColor="bg-slate-600" title="Integrations"
            onClick={() => navigate('/integrations')}
            right={<ChevronRight size={20} className="text-slate-400" />}
          />
          <Row
            icon={Bell} iconColor="bg-pink-500" title="Notification History"
            onClick={() => navigate('/notifications')}
            right={<ChevronRight size={20} className="text-slate-400" />}
          />
        </Section>

      </div>
    </div>
  );
}
