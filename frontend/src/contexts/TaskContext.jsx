import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { triggerExactAlarm, cancelAlarm } from '../utils/nativeBridge';

const TaskContext = createContext();

export function TaskProvider({ children }) {
  const { token, API_BASE, profile } = useAuth();
  
  // Initialize from cache if available to prevent loading flashes
  const [tasks, setTasks] = useState(() => {
    const cached = localStorage.getItem('taskpulse_tasks');
    if (!cached) return [];
    try {
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  
  const [loadingTasks, setLoadingTasks] = useState(!localStorage.getItem('taskpulse_tasks'));
  const [lastFetched, setLastFetched] = useState(null);

  const fetchTasks = useCallback(async (force = false) => {
    if (!token) return;
    
    // Don't refetch if we fetched in the last 10 seconds unless forced
    if (!force && lastFetched && (Date.now() - lastFetched < 10000)) return;
    
    if (tasks.length === 0) setLoadingTasks(true);
    
    try {
      const res = await fetch(`${API_BASE}/tasks/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const fetchedTasks = data.tasks || [];
        setTasks(fetchedTasks);
        localStorage.setItem('taskpulse_tasks', JSON.stringify(fetchedTasks));
        setLastFetched(Date.now());
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoadingTasks(false);
    }
  }, [token, API_BASE, lastFetched, tasks.length]);

  // Fetch tasks on mount or token change
  useEffect(() => {
    if (token) {
      fetchTasks();
    } else {
      setTasks([]);
      localStorage.removeItem('taskpulse_tasks');
    }
  }, [token, fetchTasks]);

  // Schedule exact OS alarms when tasks change
  useEffect(() => {
    // If BOTH alarms and push notifications are disabled, we don't need to schedule the background receiver at all
    if (!profile?.alarm_enabled && !profile?.push_notifications) return;

    const now = Date.now();
    if (!window.__scheduledAlarms) window.__scheduledAlarms = new Set();
    
    tasks.forEach(task => {
      if (task.status !== 'completed' && task.scheduled_start) {
        const startMillis = new Date(task.scheduled_start).getTime();
        // Schedule if it's in the future
        if (startMillis > now) {
          const alarmKey = `${task.id}_${startMillis}_${profile?.alarm_enabled}`;
          
          if (!window.__scheduledAlarms.has(alarmKey)) {
            triggerExactAlarm(task.name, startMillis, profile?.alarm_enabled);
            window.__scheduledAlarms.add(alarmKey);
          }
        }
      }
    });
  }, [tasks, profile?.alarm_enabled, profile?.push_notifications]);

  const addTask = async (newTaskData) => {
    // Optimistic UI update could go here, but let's wait for DB to get the ID
    try {
      const res = await fetch(`${API_BASE}/tasks/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newTaskData)
      });
      if (res.ok) {
        const data = await res.json();
        const savedTask = data.task;
        
        // Immediate UI update so user sees task created instantly
        setTasks(prev => {
          const updated = [savedTask, ...prev.filter(t => t.id !== savedTask.id)];
          localStorage.setItem('taskpulse_tasks', JSON.stringify(updated));
          return updated;
        });

        // Trigger scheduler asynchronously to assign time slot and refresh task state
        fetch(`${API_BASE}/reschedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ tasks: [], fixed_events: [], reference_time: new Date().toISOString() })
        }).then(async (schedRes) => {
          if (schedRes.ok) {
            // Force fetch updated scheduled start/end times
            await fetchTasks(true);
          } else {
            console.error('Auto-schedule failed with status:', schedRes.status);
          }
        }).catch(e => console.warn('Auto-schedule background warning:', e));

        return savedTask;
      }
    } catch (err) {
      console.error('Error adding task:', err);
    }
    return null;
  };

  const updateTask = async (id, updates) => {
    // Optimistic update
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      localStorage.setItem('taskpulse_tasks', JSON.stringify(updated));
      return updated;
    });

    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          setTasks(prev => {
            const updated = prev.map(t => t.id === id ? { ...t, ...data.task } : t);
            localStorage.setItem('taskpulse_tasks', JSON.stringify(updated));
            return updated;
          });
        }
      } else {
        console.error('Failed to update task on backend', res.status);
        fetchTasks(true);
      }
    } catch (err) {
      console.error('Error updating task:', err);
      fetchTasks(true);
    }
  };

  const deleteTask = async (id) => {
    // Optimistic update
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem('taskpulse_tasks', JSON.stringify(updated));
      return updated;
    });

    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        console.error('Failed to delete task on backend', res.status);
        fetchTasks(true);
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      fetchTasks(true);
    }
  };

  return (
    <TaskContext.Provider value={{
      tasks,
      loadingTasks,
      fetchTasks,
      addTask,
      updateTask,
      deleteTask
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  return useContext(TaskContext);
}
