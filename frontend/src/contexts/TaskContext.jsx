import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const TaskContext = createContext();

export function TaskProvider({ children }) {
  const { token, API_BASE } = useAuth();
  
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
        setTasks(prev => {
          const updated = [savedTask, ...prev];
          localStorage.setItem('taskpulse_tasks', JSON.stringify(updated));
          return updated;
        });
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
      await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error('Error updating task:', err);
      // In a production app, we'd roll back here on failure
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
      await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
