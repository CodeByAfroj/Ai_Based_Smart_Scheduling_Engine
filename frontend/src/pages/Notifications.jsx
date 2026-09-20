import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Check, Clock, AlertTriangle, Sparkles, CheckCheck, ShieldAlert } from 'lucide-react';

export default function Notifications() {
  const { token, API_BASE } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [token]);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (e) {
      console.error('Failed to mark read', e);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    for (const n of unread) {
      await markAsRead(n.id);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="bg-[var(--bg-app)] pb-28 lg:pb-12 pt-3 lg:pt-8 min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)]">Notifications</h1>
              {unreadCount > 0 ? (
                <span className="bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {unreadCount} Unread
                </span>
              ) : (
                <span className="bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Check size={12} /> All Read
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">Alerts, deadline alarms, and historical notifications</p>
          </div>

          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="btn-ghost py-2 px-3.5 text-xs sm:text-sm flex items-center gap-1.5 self-start sm:self-auto text-[var(--accent-base)] hover:bg-[var(--accent-light)]"
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          )}
        </div>

        {/* Panel Container */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)] flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Recent Activity</span>
            <span className="text-xs text-[var(--text-muted)]">{notifications.length} total</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[var(--text-muted)] text-sm flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[var(--accent-base)] border-t-transparent rounded-full animate-spin" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center mb-3 shadow-inner">
                <Bell className="h-7 w-7 text-[var(--text-muted)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--text-main)] mb-1">No notifications yet</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-xs">You're all caught up! Scheduled reminders and deadline alarms will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {notifications.map(n => {
                const isAlarm = n.title?.toLowerCase().includes('alarm') || n.title?.toLowerCase().includes('deadline');
                const isReminder = n.type === 'reminder' || n.title?.toLowerCase().includes('reminder');

                return (
                  <div 
                    key={n.id} 
                    className={`p-4 sm:p-5 flex items-start gap-3 sm:gap-4 transition-colors ${!n.is_read ? 'bg-blue-500/[0.03] dark:bg-blue-500/[0.05]' : 'hover:bg-[var(--bg-hover)]'}`}
                  >
                    {/* Notification Icon */}
                    <div className={`mt-0.5 p-2.5 rounded-xl shrink-0 shadow-sm ${
                      isAlarm 
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                        : isReminder 
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {isAlarm ? <ShieldAlert size={18} /> : isReminder ? <Clock size={18} /> : <Sparkles size={18} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                        <h4 className={`text-sm leading-snug break-words ${!n.is_read ? 'font-bold text-[var(--text-main)]' : 'font-medium text-[var(--text-main)]'}`}>
                          {n.title}
                        </h4>
                        <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap shrink-0 font-medium">
                          {n.created_at ? new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just now'}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed whitespace-pre-wrap break-words">{n.message}</p>
                    </div>

                    {/* Action button */}
                    {!n.is_read && (
                      <button 
                        onClick={() => markAsRead(n.id)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors shrink-0 ml-1"
                        title="Mark read"
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
