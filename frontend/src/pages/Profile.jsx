import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Clock, Zap, Calendar,
  SlidersHorizontal, ShieldCheck, Target, User as UserIcon, Settings,
  ChevronRight
} from 'lucide-react';

// Reusable UI Components matching Settings.jsx
const Section = ({ title, children, footer }) => (
  <div className="mb-8">
    {title && <p className="px-4 text-[13px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{title}</p>}
    <div className="bg-white dark:bg-[#1a1a1c] border rounded-2xl border-slate-200 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5 shadow-sm">
      {children}
    </div>
    {footer && <p className="px-4 text-[13px] text-slate-500 dark:text-slate-400 mt-2">{footer}</p>}
  </div>
);

const Row = ({ icon: Icon, iconColor, title, subtitle, right, onClick, isButton, badge }) => {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component 
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 px-4 py-3 ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 dark:active:bg-white/10 transition-colors text-left' : ''} ${isButton ? 'justify-center' : ''}`}
    >
      {!isButton && Icon && (
        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0 shadow-sm ${iconColor || 'bg-slate-500'}`}>
          <Icon size={16} />
        </div>
      )}
      {!isButton && (
        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
          <div className="flex items-center gap-2">
            <p className="text-[15px] text-slate-900 dark:text-slate-100 leading-tight truncate">{title}</p>
            {badge && <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">{badge}</span>}
          </div>
          {subtitle && <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{subtitle}</p>}
        </div>
      )}
      {isButton && (
        <div className="flex-1 text-center">
          <p className="text-[15px] font-medium text-blue-600 dark:text-blue-500">{title}</p>
        </div>
      )}
      {right && <div className="shrink-0 flex items-center">{right}</div>}
    </Component>
  );
};


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
    <div className="min-h-screen bg-slate-100 dark:bg-black pb-28 pt-4 lg:pt-8">
      <div className="max-w-2xl mx-auto px-4">
        
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Profile</h1>

        {/* Profile Card Block */}
        <div className="bg-white dark:bg-[#1a1a1c] border rounded-2xl border-slate-200 dark:border-white/10 overflow-hidden shadow-sm mb-8 flex flex-col sm:flex-row items-center sm:items-start p-6 gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-slate-100 dark:border-white/10">
              {picture ? (
                <img src={picture} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">{name.charAt(0)}</div>
              )}
            </div>
            <span className="absolute bottom-0 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-[#1a1a1c]"></span>
          </div>
          
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 justify-center sm:justify-start">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{name}</h2>
              <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider hidden sm:inline-block">Verified User</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{email}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                <CheckCircle2 size={12} /> Google Auth Synced
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-500/20">
                <ShieldCheck size={12} /> {profession} ({age}{age !== 'Age not set' && 'y'})
              </span>
            </div>
          </div>
        </div>

        {/* Configuration Actions */}
        <Section>
          <Row 
            icon={SlidersHorizontal} iconColor="bg-blue-500" title="Edit Work Hours & Preferences" 
            onClick={() => navigate('/profile-setup')}
            right={<ChevronRight size={20} className="text-slate-400" />}
          />
          <Row 
            icon={Settings} iconColor="bg-slate-600" title="App Settings" 
            onClick={() => navigate('/settings')}
            right={<ChevronRight size={20} className="text-slate-400" />}
          />
        </Section>

        {/* AI Scheduling Profile */}
        <Section title="AI Scheduling Profile">
          <Row 
            icon={Target} iconColor="bg-indigo-500" 
            title="Work Style" 
            subtitle={workStyle}
          />
          <Row 
            icon={Clock} iconColor="bg-emerald-500" 
            title="Timezone" 
            subtitle={timezone}
          />
          <Row 
            icon={Zap} iconColor="bg-orange-500" 
            title="Task Categories" 
            subtitle={categories.length > 0 ? categories.join(', ') : 'No categories configured'}
          />
        </Section>

        {/* Scheduling Rules */}
        <Section title="Scheduling Rules">
          {schedulingRules.map((rule, i) => (
            <Row 
              key={i}
              icon={rule.icon} iconColor={rule.color} 
              title={rule.label} subtitle={`${rule.value} — ${rule.desc}`}
            />
          ))}
        </Section>

      </div>
    </div>
  );
}
