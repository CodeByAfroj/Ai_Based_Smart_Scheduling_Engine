import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Check, Clock, AlertTriangle } from 'lucide-react';
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
    <div className="p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] mb-2">Notifications & Reminders</h1>
          <p className="text-[var(--text-muted)]">Manage your alerts, reminders, and historical notifications.</p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-hover)] text-[var(--text-main)] rounded-lg hover:bg-[var(--border-subtle)] transition-colors text-sm font-medium"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white border border-[var(--border-subtle)] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)] font-medium text-[var(--text-main)]">
          Recent Activity
        </div>
        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)]">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-app)] flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-main)] mb-1">No notifications yet</h3>
            <p className="text-[var(--text-muted)]">You're all caught up! New reminders and alerts will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`p-6 flex items-start gap-4 transition-colors ${!notification.is_read ? 'bg-[var(--bg-app)]' : 'bg-white hover:bg-[var(--bg-app)]'}`}
              >
                <div className={`mt-1 p-2 rounded-full ${notification.type === 'reminder' ? 'bg-blue-100 text-blue-600' : 'bg-[var(--accent-base)]/10 text-[var(--accent-base)]'}`}>
                  {notification.type === 'reminder' ? <Clock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className={`font-medium ${!notification.is_read ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-main)]'}`}>
                        {notification.title}
                      </h4>
                      <p className="text-[var(--text-muted)] mt-1 text-sm whitespace-pre-wrap">{notification.message}</p>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap font-medium bg-white px-2 py-1 rounded-md border border-[var(--border-subtle)] shadow-sm">
                      {new Date(notification.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
                {!notification.is_read && (
                  <button 
                    onClick={() => markAsRead(notification.id)}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--accent-base)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors ml-2"
                    title="Mark as read"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
