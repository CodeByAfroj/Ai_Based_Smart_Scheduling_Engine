import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell, CheckCircle2, Calendar, Mail, Zap,
  Database, User, ExternalLink
} from 'lucide-react';
import { Section, Row } from '../components/ui/LayoutBlocks';

export default function Integrations() {
  const { profile, token, API_BASE } = useAuth();
  const [testingNotif, setTestingNotif] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const sendTestNotification = async () => {
    setTestingNotif(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/notifications/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
      }
    } catch (err) {
      console.error(err);
      setTestResult('error');
    } finally {
      setTestingNotif(false);
    }
  };

  return (
    <div className="bg-[var(--bg-app)] pb-24 lg:pb-12 pt-4 lg:pt-8 min-h-full">
      <div className="max-w-7xl mx-auto xl:mx-0 px-5 sm:px-8 lg:px-12">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4 scroll-mt-24">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)] mb-1">Integrations & Connections</h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">Connected services & notification channels</p>
          </div>
          <button
            onClick={sendTestNotification}
            disabled={testingNotif}
            className="btn-primary py-2 px-4 text-xs sm:text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {testingNotif ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
            ) : (
              <><Bell size={16} /> Send Test Notification</>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`p-3.5 sm:p-4 rounded-xl mb-6 sm:mb-8 flex items-center gap-3 border ${testResult === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
            {testResult === 'success' ? <CheckCircle2 size={20} className="shrink-0" /> : <Bell size={20} className="shrink-0" />}
            <div>
              <p className="font-bold text-xs sm:text-sm">
                {testResult === 'success' ? 'Test notification dispatched!' : 'Failed to send test notification'}
              </p>
              <p className="text-[11px] sm:text-xs opacity-80 mt-0.5">
                {testResult === 'success'
                  ? 'Check your backend terminal for simulated email and browser for web push.'
                  : 'Make sure backend server is running.'}
              </p>
            </div>
          </div>
        )}

        <Section title="Identity & Calendar Sync">
          <Row
            icon={User} iconColor="bg-blue-600"
            title="Google Account"
            badge={profile?.email ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" title="Connected" /> : null}
            subtitle="Google OAuth sync"
            right={<span className="hidden sm:inline text-xs text-[var(--text-muted)] font-medium max-w-[160px] truncate">{profile?.email || 'Not connected'}</span>}
          />
          <Row
            icon={Calendar} iconColor="bg-rose-500"
            title="Google Calendar"
            badge={profile?.email ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" title="Ready" /> : null}
            subtitle="Calendar event sync"
            right={
              <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="btn-ghost text-[11px] sm:text-xs py-1 px-2.5 flex items-center gap-1 shrink-0">
                <ExternalLink size={12} />
              </a>
            }
          />
        </Section>

        <Section title="Notification Channels">
          <Row
            icon={Bell} iconColor="bg-amber-500"
            title="Push Notifications"
            badge={profile?.push_notifications ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" title="Active" /> : null}
            subtitle="Real-time push"
            right={<span className="hidden sm:inline text-xs text-[var(--text-muted)] font-medium shrink-0">{profile?.push_notifications ? 'Live SSE' : 'Disabled'}</span>}
          />
          <Row
            icon={Mail} iconColor="bg-sky-500"
            title="Email Notifications"
            badge={profile?.email_summary || profile?.email ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" title="Configured" /> : null}
            subtitle="Task reminders"
            right={<span className="hidden sm:inline text-xs text-[var(--text-muted)] font-medium max-w-[160px] truncate">{profile?.email ? profile.email : 'Not configured'}</span>}
          />
        </Section>

        <Section title="Core Engines & Storage">
          <Row
            icon={Zap} iconColor="bg-indigo-600"
            title="OR-Tools Scheduling Engine"
            badge={<CheckCircle2 size={16} className="text-emerald-500 shrink-0" title="Active" />}
            subtitle="Constraint solver"
            right={<span className="hidden sm:inline text-xs text-[var(--text-muted)] font-medium shrink-0">v9.x</span>}
          />
          <Row
            icon={Database} iconColor="bg-emerald-600"
            title="MongoDB Atlas"
            badge={<CheckCircle2 size={16} className="text-emerald-500 shrink-0" title="Connected" />}
            subtitle="Cloud database"
            right={<span className="hidden sm:inline text-xs text-[var(--text-muted)] font-medium shrink-0">Async Motor</span>}
          />
        </Section>

        {/* Notification Architecture Info */}
        <Section title="Architecture Reference">
          <Row
            icon={Mail} iconColor="bg-sky-500"
            title="Email Channel"
            subtitle="FastAPI smtplib"
          />
          <Row
            icon={Bell} iconColor="bg-amber-500"
            title="Web Push Channel"
            subtitle="SSE stream"
          />
        </Section>

      </div>
    </div>
  );
}
