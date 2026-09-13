import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link as LinkIcon, CheckCircle2, ExternalLink, Calendar, Mail, Bell, Zap, RefreshCcw } from 'lucide-react';

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

  const integrations = [
    {
      name: 'Google Account',
      description: 'Authentication & user identity via Google OAuth 2.0',
      icon: '🔐',
      status: profile?.email ? 'connected' : 'disconnected',
      detail: profile?.email || 'Not connected',
      actions: [],
    },
    {
      name: 'Google Calendar',
      description: 'Read calendar events and sync scheduled tasks as calendar blocks',
      icon: '📅',
      status: profile?.email ? 'ready' : 'disconnected',
      detail: profile?.email ? 'Available via Google OAuth scope' : 'Connect Google first',
      actions: [{ label: 'Request Calendar Access', href: 'https://calendar.google.com' }],
    },
    {
      name: 'Email Notifications',
      description: 'Automated task reminders and daily schedule briefings via email',
      icon: '📧',
      status: profile?.email_summary ? 'active' : 'configured',
      detail: profile?.email ? `Delivers to ${profile.email}` : 'Connect Google first',
      actions: [],
    },
    {
      name: 'Push Notifications (Web)',
      description: 'Real-time in-app alerts via Server-Sent Events (SSE)',
      icon: '🔔',
      status: profile?.push_notifications ? 'active' : 'inactive',
      detail: profile?.push_notifications ? 'Live SSE stream connected' : 'Enable in Profile Settings',
      actions: [],
    },
    {
      name: 'OR-Tools Scheduling Engine',
      description: 'Constraint programming solver for intelligent task scheduling',
      icon: '⚡',
      status: 'active',
      detail: 'v9.x • Constraint solver with working-hours enforcement',
      actions: [],
    },
    {
      name: 'MongoDB Atlas',
      description: 'Cloud database for persistent task, profile, and schedule storage',
      icon: '🗄️',
      status: 'connected',
      detail: 'Async Motor driver • scheduling_engine database',
      actions: [],
    },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'connected':
      case 'active':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle2 size={10} /> Active</span>;
      case 'ready':
      case 'configured':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Ready</span>;
      case 'inactive':
      case 'disconnected':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Inactive</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Integrations & Connections</h1>
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
          <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 border ${testResult === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {testResult === 'success' ? <CheckCircle2 size={20} /> : <Bell size={20} />}
            <div>
              <p className="font-bold text-sm">
                {testResult === 'success' ? 'Test notification dispatched!' : 'Failed to send test notification'}
              </p>
              <p className="text-xs opacity-70">
                {testResult === 'success'
                  ? 'Check your backend terminal for the simulated email output and your browser for the web push.'
                  : 'Make sure the backend server is running.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {integrations.map((intg, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm flex flex-col sm:flex-row items-start gap-4">
              <div className="text-3xl shrink-0">{intg.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-[var(--text-main)]">{intg.name}</h3>
                  {getStatusBadge(intg.status)}
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-1">{intg.description}</p>
                <p className="text-xs text-[var(--text-muted)]">{intg.detail}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {intg.actions.map((action, j) => (
                  <a key={j} href={action.href} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5">
                    <ExternalLink size={12} /> {action.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Notification Architecture Info */}
        <div className="mt-8 bg-indigo-50 rounded-2xl border border-indigo-100 p-6">
          <div className="flex items-start gap-3">
            <Zap size={20} className="text-[var(--accent-base)] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-[var(--text-main)] mb-2">Notification Architecture</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[var(--text-muted)]">
                <div>
                  <p className="font-semibold text-[var(--text-main)] mb-1">📧 Email Channel</p>
                  <p>Uses Python <code className="bg-white px-1 rounded text-xs">smtplib</code> via FastAPI BackgroundTasks. Configure SMTP credentials in <code className="bg-white px-1 rounded text-xs">.env</code> for real delivery, otherwise emails are simulated in the backend terminal.</p>
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-main)] mb-1">🔔 Web Push Channel</p>
                  <p>Server-Sent Events (SSE) stream at <code className="bg-white px-1 rounded text-xs">/notifications/stream</code>. The frontend connects via <code className="bg-white px-1 rounded text-xs">EventSource</code> for real-time push notifications without polling.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
