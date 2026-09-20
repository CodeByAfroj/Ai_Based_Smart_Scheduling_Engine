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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 scroll-mt-24">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-main)] mb-1">Integrations & Connections</h1>
            <p className="text-sm text-[var(--text-muted)]">Manage your connected services and notification channels</p>
          </div>
          <button
            onClick={sendTestNotification}
            disabled={testingNotif}
            className="btn-primary py-2.5 px-5 text-sm flex items-center gap-2"
          >
            {testingNotif ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
            ) : (
              <><Bell size={16} /> Send Test Notification</>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`p-4 rounded-xl mb-8 flex items-center gap-3 border ${testResult === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
            {testResult === 'success' ? <CheckCircle2 size={20} /> : <Bell size={20} />}
            <div>
              <p className="font-bold text-sm">
                {testResult === 'success' ? 'Test notification dispatched!' : 'Failed to send test notification'}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {testResult === 'success'
                  ? 'Check your backend terminal for the simulated email output and your browser for the web push.'
                  : 'Make sure the backend server is running.'}
              </p>
            </div>
          </div>
        )}

        <Section title="Identity & Calendar Sync">
          <Row 
            icon={User} iconColor="bg-blue-600"
            title="Google Account"
            badge={profile?.email ? 'connected' : 'disconnected'}
            subtitle="Authentication & user identity via Google OAuth 2.0"
            right={<span className="text-xs text-[var(--text-muted)] font-medium">{profile?.email || 'Not connected'}</span>}
          />
          <Row 
            icon={Calendar} iconColor="bg-rose-500"
            title="Google Calendar"
            badge={profile?.email ? 'ready' : 'disconnected'}
            subtitle="Read calendar events and sync scheduled tasks as calendar blocks"
            right={
              <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="btn-ghost text-[11px] sm:text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1 shrink-0">
                <ExternalLink size={12} /> <span className="hidden sm:inline">Request </span>Access
              </a>
            }
          />
        </Section>

        <Section title="Notification Channels">
          <Row 
            icon={Bell} iconColor="bg-amber-500"
            title="Push Notifications (Web)"
            badge={profile?.push_notifications ? 'active' : 'inactive'}
            subtitle="Real-time in-app alerts via Server-Sent Events (SSE)"
            right={<span className="text-xs text-[var(--text-muted)] font-medium">{profile?.push_notifications ? 'Live SSE Connected' : 'Disabled'}</span>}
          />
          <Row 
            icon={Mail} iconColor="bg-sky-500"
            title="Email Notifications"
            badge={profile?.email_summary ? 'active' : 'configured'}
            subtitle="Automated task reminders and daily schedule briefings via email"
            right={<span className="text-xs text-[var(--text-muted)] font-medium">{profile?.email ? `To: ${profile.email}` : 'Not configured'}</span>}
          />
        </Section>

        <Section title="Core Engines & Storage">
          <Row 
            icon={Zap} iconColor="bg-indigo-600"
            title="OR-Tools Scheduling Engine"
            badge="active"
            subtitle="Constraint programming solver for intelligent task scheduling"
            right={<span className="text-xs text-[var(--text-muted)] font-medium hidden sm:inline">v9.x</span>}
          />
          <Row 
            icon={Database} iconColor="bg-emerald-600"
            title="MongoDB Atlas"
            badge="connected"
            subtitle="Cloud database for persistent task, profile, and schedule storage"
            right={<span className="text-xs text-[var(--text-muted)] font-medium hidden sm:inline">Async Motor</span>}
          />
        </Section>

        {/* Notification Architecture Info */}
        <Section title="Architecture Reference">
          <Row 
            icon={Mail} iconColor="bg-sky-500"
            title="Email Channel"
            subtitle={<>Uses Python <code className="bg-[var(--bg-app)] border border-[var(--border-subtle)] px-1 py-0.5 rounded text-[10px] font-mono mx-1">smtplib</code> via FastAPI BackgroundTasks. Simulated locally.</>}
          />
          <Row 
            icon={Bell} iconColor="bg-amber-500"
            title="Web Push Channel"
            subtitle={<>Server-Sent Events (SSE) stream at <code className="bg-[var(--bg-app)] border border-[var(--border-subtle)] px-1 py-0.5 rounded text-[10px] font-mono mx-1">/notifications/stream</code> for real-time alerts.</>}
          />
        </Section>

      </div>
    </div>
  );
}
