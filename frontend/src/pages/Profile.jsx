import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Clock, Zap, Calendar,
  SlidersHorizontal, ShieldCheck, Target, User as UserIcon, Settings
} from 'lucide-react';

export default function Profile() {
  const { profile, readinessScore } = useAuth();
  const navigate = useNavigate();

  // Use real data from Google Auth + saved settings
  const name = profile?.name || 'Your Name';
  const email = profile?.email || '';
  const picture = profile?.picture || null;
  const profession = profile?.profession || 'Profession not set';
  const age = profile?.age || 'Age not set';
  const workStyle = profile?.work_style || 'Work style not defined yet. Update your profile settings to train the AI model.';
  
  const timezone = profile?.timezone || 'Not set';
  const workStart = profile?.work_start || '09:30 AM';
  const workEnd = profile?.work_end || '06:30 PM';
  // Sleep / quiet hours are dynamically all non-active working hours
  const sleepStart = workEnd;
  const sleepEnd = workStart;
  const categories = profile?.categories || [];
  
  const pushNotif = profile?.push_notifications ?? true;
  const notifPref = profile?.notification_preference || 'text_and_sound';

  const prefLabel = {
    'text_and_sound': 'Web Push + Sound Chime (No Voice)',
    'voice': 'Web Push + Neural AI Voice Aloud',
    'sound': 'Sound Chime Only (No popup)',
    'vibrate': 'Vibration / Phone Haptic Only',
    'silent': 'Silent / Visual Only'
  }[notifPref] || 'Web Push + Sound Chime (No Voice)';

  const chronotype = profile?.chronotype || 'morning';
  const peakStart = profile?.peak_start || '09:00 AM';
  const peakEnd = profile?.peak_end || '01:00 PM';
  const wakeUpTime = profile?.wake_up_time || '07:00 AM';
  const sleepTime = profile?.sleep_time || '11:00 PM';
  const breakInterval = profile?.break_interval || 50;
  const weekendPref = profile?.weekend_preference === 'flex_work' ? 'Flex Work Allowed' : 'Strict Rest Mode';

  const schedulingRules = [
    { icon: Clock, label: 'Core Active Working Hours', value: `${workStart} – ${workEnd}`, color: 'text-[var(--accent-base)]', desc: 'Calendar automatically restricts tasks to your standard active work day.' },
    { icon: Zap, label: `Peak Focus Window (${chronotype.toUpperCase()})`, value: `${peakStart} – ${peakEnd}`, color: 'text-amber-600 dark:text-amber-500', desc: 'High & Critical priority tasks are prioritized into this peak energy block.' },
    { icon: UserIcon, label: 'Daily Rhythm & Biometrics', value: `Wake: ${wakeUpTime} | Sleep: ${sleepTime}`, color: 'text-purple-600 dark:text-purple-400', desc: 'Used by AI Recommendation engine to calculate focus scores & avoid fatigue.' },
    { icon: Target, label: 'Break & Weekend Policy', value: `${breakInterval}m Focus Max | ${weekendPref}`, color: 'text-emerald-600 dark:text-emerald-500', desc: 'Enforces micro-breaks and protects weekend rest days.' },
    { icon: Calendar, label: 'Quiet / Sleep Hours (Non-Active)', value: `${sleepStart} – ${sleepEnd}`, color: 'text-[var(--text-muted)]', desc: 'All hours outside active working window are strictly reserved for sleep & rest.' },
  ];


  return (
    <div className="min-h-screen bg-[var(--bg-app)]">


      <div className="max-w-5xl mx-auto px-4 lg:px-10 py-8">
        {/* Profile Header */}
        <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 lg:p-8 mb-6 flex flex-col lg:flex-row gap-6 lg:items-start shadow-sm">
          <div className="relative shrink-0">
            <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-[var(--border-subtle)]">
              {picture ? (
                <img src={picture} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">{name.charAt(0)}</div>
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-5 h-5 bg-green-400 rounded-full border-2 border-[var(--bg-panel)]"></span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col lg:flex-row lg:items-start gap-3 mb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-[var(--text-main)]">{name}</h1>
                  <span className="bg-[var(--accent-base)] text-white text-[10px] font-bold px-2 py-0.5 rounded">Verified User</span>
                </div>
                <div className="flex items-center gap-4 text-[var(--text-muted)] text-sm mb-1 mt-2">
                  <span className="flex items-center gap-1.5"><UserIcon size={14} /> {profession}</span>
                  <span className="flex items-center gap-1.5"><Target size={14} /> {age}{age !== 'Age not set' && ' yrs old'}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4">{email}</p>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1 text-xs font-semibold text-[var(--accent-base)] bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                <CheckCircle2 size={12} /> Google Auth Synced
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                <Zap size={12} /> Live Event Stream
              </span>
            </div>
          </div>

          <div className="flex flex-row lg:flex-col gap-3 shrink-0">
            <button onClick={() => navigate('/profile-setup')} className="btn-primary text-sm py-2.5 px-4 flex items-center gap-2">
              <SlidersHorizontal size={16} /> Edit Work Hours & Preferences
            </button>
            <button onClick={() => navigate('/settings')} className="btn-ghost text-sm py-2.5 px-4 flex items-center gap-2">
              <Settings size={16} /> App Settings
            </button>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-6">
            {/* Work Style & Time Zone */}
            <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 text-[var(--accent-base)] p-2 rounded-lg"><Clock size={18} /></div>
                  <h2 className="font-bold text-[var(--text-main)]">AI Scheduling Profile</h2>
                </div>
              </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[var(--bg-app)] p-5 rounded-xl border border-[var(--border-subtle)]">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">Work Style Preference</p>
                <p className="text-sm text-[var(--text-main)] leading-relaxed font-medium">
                  {workStyle}
                </p>
              </div>
              <div className="bg-[var(--bg-app)] p-5 rounded-xl border border-[var(--border-subtle)] flex flex-col justify-center">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">Current Timezone</p>
                <p className="font-bold text-[var(--text-main)] text-xl mb-1">{timezone}</p>
                <p className="text-sm text-[var(--text-muted)]">Core hours: {workStart} – {workEnd}</p>
              </div>
            </div>
            </div>

            {/* Categories */}
            <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[var(--text-main)]">Task Categories</h2>
              </div>
              {categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg bg-[var(--accent-light)] text-[var(--accent-base)] text-xs font-semibold">{cat}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No task categories configured.</p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-6">
            {/* Scheduling Rules */}
            <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-amber-100 text-amber-600 p-2 rounded-lg"><SlidersHorizontal size={18} /></div>
                <h2 className="font-bold text-[var(--text-main)]">Scheduling Rules</h2>
              </div>
              <div className="flex flex-col gap-3">
                {schedulingRules.map((rule, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 mb-1">
                      <rule.icon size={14} className="text-[var(--text-muted)]" />
                      <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">{rule.label}</p>
                    </div>
                    <p className={`font-bold text-sm mb-1 ${rule.color}`}>{rule.value}</p>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{rule.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            </div>
          </div>
        </div>
      </div>
  );
}
