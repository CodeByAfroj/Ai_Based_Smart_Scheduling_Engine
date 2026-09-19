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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'connected':
      case 'active':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 flex items-center gap-1 border border-green-500/20"><CheckCircle2 size={10} /> Active</span>;
      case 'ready':
      case 'configured':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">Ready</span>;
      case 'inactive':
      case 'disconnected':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-subtle)]">Inactive</span>;
      default:
        return null;
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
            title={<div className="flex items-center gap-2">Google Account {getStatusBadge(profile?.email ? 'connected' : 'disconnected')}</div>}
            subtitle={
              <div>
                <span className="hidden sm:block text-[var(--text-main)] font-medium mb-0.5">Authentication & user identity via Google OAuth 2.0</span>
                <span className="block text-[11px] opacity-70">{profile?.email || 'Not connected'}</span>
              </div>
            }
          />
          <Row 
            icon={Calendar} iconColor="bg-rose-500"
            title={<div className="flex items-center gap-2">Google Calendar {getStatusBadge(profile?.email ? 'ready' : 'disconnected')}</div>}
            subtitle={
              <div>
                <span className="hidden sm:block text-[var(--text-main)] font-medium mb-0.5">Read calendar events and sync scheduled tasks as calendar blocks</span>
                <span className="block text-[11px] opacity-70">{profile?.email ? 'Available via Google OAuth scope' : 'Connect Google first'}</span>
              </div>
            }
            right={
              <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="btn-ghost text-[11px] sm:text-xs py-1.5 px-2.5 sm:px-3 flex items-center gap-1 shrink-0">
                <ExternalLink size={12} /> <span className="hidden sm:inline">Request </span>Calendar Access
              </a>
            }
          />
        </Section>

        <Section title="Notification Channels">
          <Row 
            icon={Bell} iconColor="bg-amber-500"
            title={<div className="flex items-center gap-2">Push Notifications (Web) {getStatusBadge(profile?.push_notifications ? 'active' : 'inactive')}</div>}
            subtitle={
              <div>
                <span className="hidden sm:block text-[var(--text-main)] font-medium mb-0.5">Real-time in-app alerts via Server-Sent Events (SSE)</span>
                <span className="block text-[11px] opacity-70">{profile?.push_notifications ? 'Live SSE stream connected' : 'Enable in Profile Settings'}</span>
              </div>
            }
          />
          <Row 
            icon={Mail} iconColor="bg-sky-500"
            title={<div className="flex items-center gap-2">Email Notifications {getStatusBadge(profile?.email_summary ? 'active' : 'configured')}</div>}
            subtitle={
              <div>
                <span className="hidden sm:block text-[var(--text-main)] font-medium mb-0.5">Automated task reminders and daily schedule briefings via email</span>
                <span className="block text-[11px] opacity-70">{profile?.email ? `Delivers to ${profile.email}` : 'Connect Google first'}</span>
              </div>
            }
          />
        </Section>

        <Section title="Core Engines & Storage">
          <Row 
            icon={Zap} iconColor="bg-indigo-600"
            title={<div className="flex items-center gap-2">OR-Tools Scheduling Engine {getStatusBadge('active')}</div>}
            subtitle={
              <div>
                <span className="hidden sm:block text-[var(--text-main)] font-medium mb-0.5">Constraint programming solver for intelligent task scheduling</span>
                <span className="block text-[11px] opacity-70">v9.x • Constraint solver with working-hours enforcement</span>
              </div>
            }
          />
          <Row 
            icon={Database} iconColor="bg-emerald-600"
            title={<div className="flex items-center gap-2">MongoDB Atlas {getStatusBadge('connected')}</div>}
            subtitle={
              <div>
                <span className="hidden sm:block text-[var(--text-main)] font-medium mb-0.5">Cloud database for persistent task, profile, and schedule storage</span>
                <span className="block text-[11px] opacity-70">Async Motor driver • scheduling_engine database</span>
              </div>
            }
          />
        </Section>

        {/* Notification Architecture Info */}
        <Section title="Architecture Reference">
          <div className="p-5 flex items-start gap-4 text-sm text-[var(--text-muted)] bg-[var(--bg-app)]">
            <Zap size={20} className="text-[var(--accent-base)] shrink-0 mt-0.5" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <div>
                <p className="font-bold text-[var(--text-main)] flex items-center gap-2 mb-1.5"><Mail size={14} className="text-sky-500" /> Email Channel</p>
                <p className="leading-relaxed">Uses Python <code className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded text-[11px] font-mono">smtplib</code> via FastAPI BackgroundTasks. Configure SMTP credentials in <code className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded text-[11px] font-mono">.env</code> for real delivery, otherwise emails are simulated in the backend terminal.</p>
              </div>
              <div>
                <p className="font-bold text-[var(--text-main)] flex items-center gap-2 mb-1.5"><Bell size={14} className="text-amber-500" /> Web Push Channel</p>
                <p className="leading-relaxed">Server-Sent Events (SSE) stream at <code className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded text-[11px] font-mono">/notifications/stream</code>. The frontend connects via <code className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded text-[11px] font-mono">EventSource</code> for real-time push notifications without polling.</p>
              </div>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
