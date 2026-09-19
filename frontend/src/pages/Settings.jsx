import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell, Moon, Sun, Monitor, Vibrate, Volume2, VolumeX,
  MessageSquare, Activity, Play, Square, AlertCircle, RefreshCw,
  ChevronRight, Zap, Smartphone, Settings as SettingsIcon, CheckCircle2
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLiveTracking } from '../contexts/TrackingContext';

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
    { id: 'voice',         icon: Volume2,       label: 'Neural AI Voice',     desc: 'Humanized TTS reads alerts aloud via edge-tts',        color: 'bg-indigo-500' },
    { id: 'text_and_sound',icon: MessageSquare,  label: 'Text + Sound Chime',  desc: 'Popup notification with a glass chime tone',           color: 'bg-blue-500'   },
    { id: 'sound',         icon: Volume2,        label: 'Sound Only',          desc: 'Plays chime without popup or voice',                    color: 'bg-emerald-500'},
    { id: 'vibrate',       icon: Vibrate,        label: 'Vibrate / Haptic',    desc: 'Silent phone vibration pattern, no sound',             color: 'bg-amber-500'  },
    { id: 'silent',        icon: VolumeX,        label: 'Silent / Visual Only',desc: 'In-app badge only, no sound or haptic',                color: 'bg-slate-500'  },
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

        {/* Notifications */}
        <Section title="Notifications">
          <Row 
            icon={Smartphone} iconColor="bg-red-500" title="Push Notifications" subtitle="Alerts outside the app"
            right={<Toggle checked={pushEnabled} onChange={handlePushToggle} />}
          />
          <Row 
            icon={Bell} iconColor="bg-orange-500" title="In-App Alarms" subtitle="Play sounds when app is open"
            right={<Toggle checked={alarmEnabled} onChange={setAndSaveAlarm} />}
          />
        </Section>

        {/* Alert Style */}
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
