import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock, CheckCircle2, ArrowRight, User as UserIcon, Briefcase, Target, X, Plus, ChevronDown, Sparkles, Sun, Moon, Bell, Shield
} from 'lucide-react';
import { Section, Row } from '../components/ui/LayoutBlocks';

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

  // Step 2: Work Hours & Biometrics
  const [timezone, setTimezone] = useState(profile?.timezone || 'UTC+05:30 (IST)');
  const [startTime, setStartTime] = useState(profile?.work_start || '09:30 AM');
  const [endTime, setEndTime] = useState(profile?.work_end || '06:30 PM');
  const [chronotype, setChronotype] = useState(profile?.chronotype || 'morning');
  const [wakeUpTime, setWakeUpTime] = useState(profile?.wake_up_time || '07:00 AM');
  const [sleepTime, setSleepTime] = useState(profile?.sleep_time || '11:00 PM');
  const [breakInterval, setBreakInterval] = useState(profile?.break_interval || 50);
  const [weekendPref, setWeekendPref] = useState(profile?.weekend_preference || 'strict_rest');
  const [bufferEnabled, setBufferEnabled] = useState(profile?.buffer_enabled ?? true);

  // Step 3: Tags
  const [tags, setTags] = useState(profile?.categories?.length > 0 ? profile.categories : ['Engineering', 'Sprint Review', 'Deep Work']);
  const [customTag, setCustomTag] = useState('');

  const completedSteps = [
    !!(age && profession && workStyle),
    !!(timezone && startTime && endTime && wakeUpTime && sleepTime),
    tags.length > 0
  ];
  
  const totalSteps = 3;
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
          chronotype,
          wake_up_time: wakeUpTime,
          sleep_time: sleepTime,
          break_interval: parseInt(breakInterval) || 50,
          weekend_preference: weekendPref,
          buffer_enabled: bufferEnabled,
          categories: tags,
          is_complete: true,
          push_notifications: profile?.push_notifications ?? true,
          desktop_notifications: profile?.desktop_notifications ?? true,
          email_summary: profile?.email_summary ?? false,
          notification_preference: profile?.notification_preference || 'text_and_sound',
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

  const CircleProgress = ({ value }) => {
    const r = 40;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    return (
      <div className="relative flex items-center justify-center">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="7" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent-base)" strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-[var(--text-main)] leading-none">{value}</span>
          <span className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">/100</span>
        </div>
      </div>
    );
  };

  const Toggle = ({ enabled, onToggle }) => (
    <button 
      type="button"
      onClick={onToggle} 
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out shrink-0 ${enabled ? 'bg-[var(--accent-base)]' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <span className={`inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${enabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
    </button>
  );

  return (
    <div className="bg-[var(--bg-app)] min-h-full pb-24 lg:pb-12 pt-4 lg:pt-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent-base)] border border-[var(--accent-base)]/20 flex items-center gap-1">
                <Sparkles size={12} /> AI Scheduling Parameters
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)] leading-tight">
              Profile & Scheduling Parameters
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              Help the AI understand how you work best.
            </p>
          </div>
          
          <div className="hidden sm:flex flex-col items-center shrink-0 bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-3 rounded-2xl shadow-sm">
            <CircleProgress value={readinessScore} />
            <span className="text-[11px] font-medium text-[var(--text-muted)] mt-1">Profile Completion</span>
          </div>
        </div>

        {/* Mobile readiness banner */}
        <div className="sm:hidden flex items-center justify-between mb-6 bg-[var(--bg-panel)] p-4 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
          <div>
            <h3 className="font-bold text-[var(--text-main)] text-sm">Profile Completion</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Complete details for AI optimization</p>
          </div>
          <CircleProgress value={readinessScore} />
        </div>

        {/* Section 1: Personal Details & Work Style */}
        <Section title="1. Personal Details & Work Style">
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <UserIcon size={14} className="text-[var(--accent-base)]" /> Age
                </label>
                <input 
                  type="number" 
                  value={age} 
                  onChange={e => setAge(e.target.value)} 
                  placeholder="e.g. 28" 
                  className="input-field" 
                  min="1" 
                  max="120" 
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-[var(--accent-base)]" /> Profession / Role
                </label>
                <div className="relative">
                  <select 
                    value={profession} 
                    onChange={e => setProfession(e.target.value)} 
                    className="input-field appearance-none pr-9"
                  >
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
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Target size={14} className="text-[var(--accent-base)]" /> Primary Work Style Preference
              </label>
              <div className="relative">
                <select 
                  value={workStyle} 
                  onChange={e => setWorkStyle(e.target.value)} 
                  className="input-field appearance-none pr-9"
                >
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
        </Section>

        {/* Section 2: Daily Working Hours & Time Zone */}
        <Section title="2. Daily Working Hours & Time Zone">
          <div className="p-4 sm:p-5 space-y-5">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock size={14} className="text-amber-500" /> Standard Primary Timezone
              </label>
              <div className="relative">
                <select 
                  value={timezone} 
                  onChange={e => setTimezone(e.target.value)} 
                  className="input-field appearance-none pr-9"
                >
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

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
                Core Working Window
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5 font-medium">
                    <Sun size={13} className="text-amber-500" /> Start Work
                  </label>
                  <input 
                    type="text" 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)} 
                    placeholder="09:30 AM" 
                    className="input-field" 
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5 font-medium">
                    <Moon size={13} className="text-blue-500" /> End Work
                  </label>
                  <input 
                    type="text" 
                    value={endTime} 
                    onChange={e => setEndTime(e.target.value)} 
                    placeholder="06:30 PM" 
                    className="input-field" 
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
                Circadian Rhythm & Daily Biometrics
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block font-medium">Chronotype</label>
                  <div className="relative">
                    <select 
                      value={chronotype} 
                      onChange={e => setChronotype(e.target.value)} 
                      className="input-field appearance-none pr-8"
                    >
                      <option value="morning">Morning Lark (Early Focus)</option>
                      <option value="afternoon">Intermediate (Midday Focus)</option>
                      <option value="night">Night Owl (Evening Focus)</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={15} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block font-medium">Wake-up Time</label>
                  <input 
                    type="text" 
                    value={wakeUpTime} 
                    onChange={e => setWakeUpTime(e.target.value)} 
                    placeholder="07:00 AM" 
                    className="input-field" 
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block font-medium">Sleep Time</label>
                  <input 
                    type="text" 
                    value={sleepTime} 
                    onChange={e => setSleepTime(e.target.value)} 
                    placeholder="11:00 PM" 
                    className="input-field" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                  Max Focus Block Before Break (Mins)
                </label>
                <input 
                  type="number" 
                  value={breakInterval} 
                  onChange={e => setBreakInterval(e.target.value)} 
                  placeholder="50" 
                  min="20" 
                  max="180" 
                  className="input-field" 
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                  Weekend Mode
                </label>
                <div className="relative">
                  <select 
                    value={weekendPref} 
                    onChange={e => setWeekendPref(e.target.value)} 
                    className="input-field appearance-none pr-9"
                  >
                    <option value="strict_rest">Strict Rest (No weekend tasks)</option>
                    <option value="flex_work">Flex Work (Allowed for high priority tasks)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-base)]/10 flex items-center justify-center shrink-0">
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
        </Section>

        {/* Section 3: Task Categories & Taxonomy */}
        <Section title="3. Task Categories & Taxonomy">
          <div className="p-4 sm:p-5 space-y-4">
            <p className="text-xs text-[var(--text-muted)]">Default smart buckets automatically assigned to inbound tickets and AI suggestions.</p>

            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span 
                  key={tag} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent-base)] text-xs font-semibold rounded-lg border border-[var(--accent-base)]/20"
                >
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-75 transition-opacity">
                    <X size={13} />
                  </button>
                </span>
              ))}
              {PRESET_TAGS.filter(t => !tags.includes(t)).map(tag => (
                <button 
                  key={tag} 
                  type="button" 
                  onClick={() => addTag(tag)}
                  className="px-3 py-1.5 border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="e.g., Code Review, User Research, AP Sync"
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && customTag.trim()) { addTag(customTag.trim()); setCustomTag(''); }}}
                className="input-field flex-1"
              />
              <button 
                type="button" 
                onClick={() => { if (customTag.trim()) { addTag(customTag.trim()); setCustomTag(''); }}}
                className="btn-primary px-4 py-2.5 shrink-0 text-xs font-semibold"
              >
                <Plus size={16} /> Add tag
              </button>
            </div>
          </div>
        </Section>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-4 pt-6 pb-12 sm:pb-0">
          <button 
            type="button" 
            onClick={() => navigate(-1)} 
            className="btn-ghost py-2.5 px-5 text-sm w-full sm:w-auto"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={saving || readinessScore < 100}
            className={`btn-primary py-2.5 px-6 text-sm shadow-md flex items-center justify-center gap-2 w-full sm:w-auto ${readinessScore < 100 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 size={16} /> Save Complete Profile <ArrowRight size={16} /></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
