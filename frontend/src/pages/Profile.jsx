import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Clock, Zap, Calendar,
  SlidersHorizontal, ShieldCheck, Target, User as UserIcon, Settings,
  ChevronRight, Sparkles, Mail
} from 'lucide-react';

import { Section, Row } from '../components/ui/LayoutBlocks';

export default function Profile() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const name = profile?.name || 'Your Name';
  const email = profile?.email || '';
  const picture = profile?.picture || null;
  const profession = profile?.profession || 'Profession not set';
  const age = profile?.age || 'Age not set';
  const workStyle = profile?.work_style || 'Work style not defined yet. Update your profile settings to train the AI model.';

  const timezone = profile?.timezone || 'Not set';
  const workStart = profile?.work_start || '09:30 AM';
  const workEnd = profile?.work_end || '06:30 PM';
  const sleepStart = workEnd;
  const sleepEnd = workStart;
  const categories = profile?.categories || [];

  const chronotype = profile?.chronotype || 'morning';
  const peakStart = profile?.peak_start || '09:00 AM';
  const peakEnd = profile?.peak_end || '01:00 PM';
  const wakeUpTime = profile?.wake_up_time || '07:00 AM';
  const sleepTime = profile?.sleep_time || '11:00 PM';
  const breakInterval = profile?.break_interval || 50;
  const weekendPref = profile?.weekend_preference === 'flex_work' ? 'Flex Work Allowed' : 'Strict Rest Mode';

  const schedulingRules = [
    { icon: Clock, label: 'Core Active Working Hours', value: `${workStart} – ${workEnd}`, color: 'bg-indigo-500', desc: 'Calendar automatically restricts tasks to your standard active work day.' },
    { icon: Zap, label: `Peak Focus Window (${chronotype.toUpperCase()})`, value: `${peakStart} – ${peakEnd}`, color: 'bg-amber-500', desc: 'High & Critical priority tasks are prioritized into this peak energy block.' },
    { icon: UserIcon, label: 'Daily Rhythm & Biometrics', value: `Wake: ${wakeUpTime} | Sleep: ${sleepTime}`, color: 'bg-purple-500', desc: 'Used by AI Recommendation engine to calculate focus scores & avoid fatigue.' },
    { icon: Target, label: 'Break & Weekend Policy', value: `${breakInterval}m Focus Max | ${weekendPref}`, color: 'bg-emerald-500', desc: 'Enforces micro-breaks and protects weekend rest days.' },
    { icon: Calendar, label: 'Quiet / Sleep Hours (Non-Active)', value: `${sleepStart} – ${sleepEnd}`, color: 'bg-slate-500', desc: 'All hours outside active working window are strictly reserved for sleep & rest.' },
  ];

  return (
    <div className="bg-[var(--bg-app)] pb-24 lg:pb-12 pt-4 lg:pt-8 min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-main)] mb-1">User Profile</h1>
            <p className="text-sm text-[var(--text-muted)]">Your personal identity, work style context, and scheduling parameters</p>
          </div>
        </div>

        {/* Profile Card Header Block */}
        <div className="bg-[var(--bg-panel)] border rounded-2xl border-[var(--border-subtle)] overflow-hidden shadow-sm mb-8 p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 border-4 border-[var(--bg-panel)] shadow-md">
                {picture ? (
                  <img src={picture} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">{name.charAt(0)}</div>
                )}
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[var(--bg-panel)] shadow-sm" />
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 justify-center sm:justify-start">
                <h2 className="text-2xl font-bold text-[var(--text-main)] truncate">{name}</h2>
                <span className="bg-[var(--accent-light)] text-[var(--accent-base)] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider self-center sm:self-auto border border-[var(--accent-base)]/20">
                  Verified User
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-3 flex items-center justify-center sm:justify-start gap-1.5">
                <Mail size={14} /> {email}
              </p>
              
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle2 size={13} /> Google Auth Synced
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-base)] bg-[var(--accent-light)] px-3 py-1 rounded-full border border-[var(--accent-base)]/20">
                  <ShieldCheck size={13} /> {profession} {age && age !== 'Age not set' ? `(${age}y)` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Actions */}
        <Section title="Quick Actions">
          <Row
            icon={SlidersHorizontal} iconColor="bg-indigo-600" 
            title="Edit Work Hours & Preferences"
            subtitle={<span className="hidden sm:block">Customize timezones, core working windows, chronotype biometrics, and task categories</span>}
            onClick={() => navigate('/profile-setup')}
            right={<ChevronRight size={18} className="text-[var(--text-muted)]" />}
          />
          <Row
            icon={Settings} iconColor="bg-slate-600" 
            title="App Settings"
            subtitle={<span className="hidden sm:block">Configure app theme, data storage, and engine connection preferences</span>}
            onClick={() => navigate('/settings')}
            right={<ChevronRight size={18} className="text-[var(--text-muted)]" />}
          />
        </Section>

        {/* AI Scheduling Profile */}
        <Section title="AI Scheduling Profile">
          <Row
            icon={Target} iconColor="bg-indigo-500"
            title="Work Style Preference"
            subtitle={workStyle}
          />
          <Row
            icon={Clock} iconColor="bg-emerald-500"
            title="Timezone & Region"
            subtitle={timezone}
          />
          <Row
            icon={Zap} iconColor="bg-amber-500"
            title="Active Task Categories"
            subtitle={categories.length > 0 ? categories.join(', ') : 'No categories configured'}
          />
        </Section>

        {/* Active Scheduling Rules */}
        <Section title="Active Scheduling Rules & Constraints">
          {schedulingRules.map((rule, i) => (
            <Row
              key={i}
              icon={rule.icon} 
              iconColor={rule.color}
              title={rule.label} 
              subtitle={
                <div>
                  <span className="font-semibold text-[var(--text-main)] block mb-0.5">{rule.value}</span>
                  <span className="hidden sm:block">{rule.desc}</span>
                </div>
              }
            />
          ))}
        </Section>

      </div>
    </div>
  );
}
