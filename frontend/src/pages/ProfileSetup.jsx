import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock, CheckCircle2, Zap, ArrowRight, User as UserIcon, Briefcase, Target, X, Plus, ChevronDown
} from 'lucide-react';

const PRESET_TAGS = ['Engineering', 'Sprint Review', 'Deep Work', 'Client Call', 'Design Critique'];

export default function ProfileSetup() {
  const { token, fetchProfile, profile } = useAuth();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);

  // Step 1: Personal & Work Style
  const [age, setAge] = useState(profile?.age || '');
  const [profession, setProfession] = useState(profile?.profession || '');
  const [workStyle, setWorkStyle] = useState(profile?.work_style || '');

  // Step 2: Work Hours
  const [timezone, setTimezone] = useState(profile?.timezone || 'UTC+05:30 (IST)');
  const [startTime, setStartTime] = useState(profile?.work_start || '09:30 AM');
  const [endTime, setEndTime] = useState(profile?.work_end || '06:30 PM');
  const [bufferEnabled, setBufferEnabled] = useState(profile?.buffer_enabled ?? true);

  // Step 3: Tags
  const [tags, setTags] = useState(profile?.categories?.length > 0 ? profile.categories : ['Engineering', 'Sprint Review', 'Deep Work']);
  const [customTag, setCustomTag] = useState('');

  // Step 4: Notification Preferences
  const [notificationPref, setNotificationPref] = useState(profile?.notification_preference || 'text_and_sound');

  const completedSteps = [
    !!(age && profession && workStyle),
    !!(timezone && startTime && endTime),
    tags.length > 0,
    !!notificationPref
  ];
  
  const totalSteps = 4;
  const readinessScore = Math.round((completedSteps.filter(Boolean).length / totalSteps) * 100);

  const addTag = (tag) => {
    if (!tags.includes(tag)) setTags([...tags, tag]);
  };

  const removeTag = (tag) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/profile/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          age: age ? parseInt(age) : null,
          profession,
          work_style: workStyle,
          timezone,
          work_start: startTime,
          work_end: endTime,
          buffer_enabled: bufferEnabled,
          categories: tags,
          is_complete: true,
          // Preserve existing notifications state
          push_notifications: profile?.push_notifications ?? true,
          desktop_notifications: profile?.desktop_notifications ?? true,
          email_summary: profile?.email_summary ?? false,
          notification_preference: notificationPref,
          quiet_hours_start: profile?.quiet_hours_start || '10:00 PM',
          quiet_hours_end: profile?.quiet_hours_end || '07:30 AM',
        })
      });
      if (res.ok) {
        await fetchProfile();
        navigate('/');
      }
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSaving(false);
    }
  };

  const testNotification = async () => {
    setTestingNotif(true);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/notifications/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Test failed', err);
    } finally {
      setTimeout(() => setTestingNotif(false), 2000);
    }
  };

  const CircleProgress = ({ value }) => {
    const r = 44;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    return (
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#e0e7ff" strokeWidth="8" />
        <circle cx="55" cy="55" r={r} fill="none" stroke="#4338ca" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text x="55" y="51" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0f172a">{value}</text>
        <text x="55" y="66" textAnchor="middle" fontSize="10" fill="#64748b">/100</text>
      </svg>
    );
  };

  const Toggle = ({ enabled, onToggle }) => (
    <button onClick={onToggle} className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-[var(--accent-base)]' : 'bg-slate-200'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-6' : ''}`} />
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Focus Score Banner */}
      <div className="bg-gradient-to-r from-[var(--accent-base)] to-indigo-500 text-white px-6 lg:px-10 py-4 flex items-center gap-4">
        <div className="bg-white/20 rounded-lg p-2 shrink-0">
          <Zap size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm">AI Scheduling Model Training</span>
            <span className="bg-green-400/30 text-green-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Active</span>
          </div>
          <p className="text-white/80 text-xs">By providing accurate details about your role and work style, our AI scheduling engine adapts to your unique rhythm, optimizing for maximum focus and minimizing burnout.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 lg:px-10 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text-main)] leading-tight">
              Profile & Scheduling Parameters
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-2">
              Help the AI understand how you work best.
            </p>
          </div>
          <div className="hidden lg:flex flex-col items-center shrink-0">
            <CircleProgress value={readinessScore} />
            <div className="mt-2 text-center">
              <p className="text-[10px] text-[var(--text-muted)]">Profile Completion</p>
            </div>
          </div>
        </div>

        {/* Mobile readiness */}
        <div className="lg:hidden flex items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-[var(--border-subtle)]">
          <CircleProgress value={readinessScore} />
          <div>
            <h3 className="font-bold text-[var(--text-main)]">Profile Completion</h3>
            <p className="text-xs text-[var(--text-muted)]">Complete all details for better scheduling</p>
          </div>
        </div>

        {/* STEP 1: Personal & Work Style */}
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-indigo-100 text-[var(--accent-base)] w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">1</div>
            <div>
              <h2 className="font-bold text-[var(--text-main)]">Personal Details & Work Style</h2>
              <p className="text-xs text-[var(--text-muted)]">Essential context for the scheduling engine to adapt to your style.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2 block flex items-center gap-1.5"><UserIcon size={14}/> Age</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 28" className="input-field" min="1" max="120" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2 block flex items-center gap-1.5"><Briefcase size={14}/> Profession / Role</label>
              <div className="relative">
                <select value={profession} onChange={e => setProfession(e.target.value)} className="input-field appearance-none">
                  <option value="" disabled>Select profession...</option>
                  <option value="Software Engineer">Software Engineer</option>
                  <option value="Product Manager">Product Manager</option>
                  <option value="Designer">Designer</option>
                  <option value="Data Scientist">Data Scientist</option>
                  <option value="Marketing">Marketing / Content</option>
                  <option value="Sales">Sales / Account Executive</option>
                  <option value="Executive">Executive / Founder</option>
                  <option value="Student">Student / Academic</option>
                  <option value="Other">Other</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2 block flex items-center gap-1.5"><Target size={14}/> Primary Work Style Preference</label>
            <div className="relative">
              <select value={workStyle} onChange={e => setWorkStyle(e.target.value)} className="input-field appearance-none">
                <option value="" disabled>How do you prefer to work?</option>
                <option value="Deep Work">Deep Work (Fewer meetings, long uninterrupted blocks)</option>
                <option value="Collaborative">Collaborative (Frequent quick syncs, highly communicative)</option>
                <option value="Balanced">Balanced (Mix of focus time and team interactions)</option>
                <option value="Maker Schedule">Maker Schedule (Half-day blocks strictly protected)</option>
                <option value="Manager Schedule">Manager Schedule (Hour-by-hour context switching)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        {/* STEP 2: Work Hours & Timezone */}
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-amber-100 text-amber-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">2</div>
            <div>
              <h2 className="font-bold text-[var(--text-main)]">Daily Working Hours & Time Zone</h2>
              <p className="text-xs text-[var(--text-muted)]">Instruct the engine on when tasks can be scheduled.</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2 block">Standard Primary Timezone</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input-field pl-9 appearance-none">
                <option>UTC+05:30 (IST)</option>
                <option>UTC+00:00 (GMT)</option>
                <option>UTC-05:00 (EST)</option>
                <option>UTC-08:00 (PST)</option>
                <option>UTC+01:00 (CET)</option>
                <option>UTC+08:00 (CST)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={16} />
            </div>
          </div>

          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3 block">Core Working Window</label>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1 block"><span className="text-amber-500">☀</span> Start</label>
              <input type="text" value={startTime} onChange={e => setStartTime(e.target.value)} placeholder="09:30 AM" className="input-field" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1 block"><span className="text-blue-500">🌙</span> End</label>
              <input type="text" value={endTime} onChange={e => setEndTime(e.target.value)} placeholder="06:30 PM" className="input-field" />
            </div>
          </div>

          <div className="flex items-center justify-between bg-[var(--bg-app)] p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Clock size={16} className="text-[var(--accent-base)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">Between-Task Buffer Window</p>
                <p className="text-xs text-[var(--text-muted)]">Enforces a 15-minute cool-down gap between back-to-back sessions.</p>
              </div>
            </div>
            <Toggle enabled={bufferEnabled} onToggle={() => setBufferEnabled(!bufferEnabled)} />
          </div>
        </div>

        {/* STEP 3: Tags */}
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">3</div>
            <div>
              <h2 className="font-bold text-[var(--text-main)]">Task Categories & Taxonomy</h2>
              <p className="text-xs text-[var(--text-muted)]">Default smart buckets automatically assigned to inbound tickets.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent-base)] text-xs font-semibold rounded-lg">
                {tag}
                <button onClick={() => removeTag(tag)}><X size={12} /></button>
              </span>
            ))}
            {PRESET_TAGS.filter(t => !tags.includes(t)).map(tag => (
              <button key={tag} onClick={() => addTag(tag)}
                className="px-3 py-1.5 border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs rounded-lg hover:bg-[var(--bg-hover)]">
                + {tag}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g., Code Review, User Research, AP Sync"
              value={customTag}
              onChange={e => setCustomTag(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customTag.trim()) { addTag(customTag.trim()); setCustomTag(''); }}}
              className="input-field flex-1"
            />
            <button onClick={() => { if (customTag.trim()) { addTag(customTag.trim()); setCustomTag(''); }}}
              className="btn-primary px-4 py-2.5 shrink-0">
              <Plus size={16} /> Add tag
            </button>
          </div>
        </div>

        {/* STEP 4: Notifications */}
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">4</div>
            <div>
              <h2 className="font-bold text-[var(--text-main)]">Alert Channels & Preferences</h2>
              <p className="text-xs text-[var(--text-muted)]">How should the engine notify you when events occur?</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2 block flex items-center gap-1.5">Notification Style</label>
            <div className="flex items-end gap-3">
              <div className="relative flex-1">
                <select value={notificationPref} onChange={e => setNotificationPref(e.target.value)} className="input-field appearance-none">
                  <option value="text_and_sound">Web Push + Notification Sound (Default)</option>
                  <option value="sound">Notification Sound Only (No popup)</option>
                  <option value="voice">Web Push + Voice (AI will read the alert aloud)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={16} />
              </div>
              <button 
                onClick={testNotification} 
                disabled={testingNotif}
                className="btn-primary py-2.5 px-4 text-sm shrink-0 flex items-center gap-2"
              >
                {testingNotif ? <CheckCircle2 size={16} /> : <Zap size={16} />} 
                {testingNotif ? 'Sent!' : 'Test'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={() => navigate(-1)} className="btn-ghost py-3.5 px-6 text-sm rounded-xl">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || readinessScore < 100}
            className={`btn-primary py-3.5 px-8 text-sm lg:text-base rounded-xl shadow-lg flex items-center gap-2 ${readinessScore < 100 ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {saving ? 'Saving...' : <><CheckCircle2 size={18} /> Save Complete Profile <ArrowRight size={18} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
