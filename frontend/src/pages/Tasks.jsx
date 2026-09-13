import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { Plus, Clock, Calendar as CalendarIcon, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { localInputToIST, defaultLocalValue, formatIST, formatDateIST } from '../utils/time';

export default function Tasks() {
  const { token } = useAuth();
  const { tasks, loadingTasks, addTask, updateTask, deleteTask } = useTasks();
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(60);
  const [earliestStart, setEarliestStart] = useState(() => defaultLocalValue(60000)); // 1 min from now
  const [deadline, setDeadline] = useState(() => defaultLocalValue(86400000 * 2));    // 2 days from now
  const [priority, setPriority] = useState(1);

  const createTask = async (e) => {
    e.preventDefault();
    await addTask({
      name,
      duration_minutes: parseInt(duration),
      earliest_start: localInputToIST(earliestStart),
      deadline: localInputToIST(deadline),
      priority: parseInt(priority)
    });
    setShowForm(false);
    setName('');
    setEarliestStart(defaultLocalValue(60000));
    setDeadline(defaultLocalValue(86400000 * 2));
  };

  const toggleStatus = (task) => {
    updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
  };

  if (loadingTasks && tasks.length === 0) return <div className="p-10 text-center text-[var(--text-muted)]">Loading tasks...</div>;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Tasks & Projects</h1>
            <p className="text-sm text-[var(--text-muted)]">Manage your backlog and feed the scheduling engine</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary py-2.5 px-5 flex items-center gap-2 text-sm">
            <Plus size={16} /> New Task
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6 mb-6 shadow-sm">
            <h2 className="font-bold text-[var(--text-main)] mb-4">Create New Task</h2>
            <form onSubmit={createTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Task Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm outline-none focus:border-[var(--accent-base)] transition-colors" placeholder="e.g., Draft Engineering Spec" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Duration (mins)</label>
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)} required min="15" step="15" className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm outline-none focus:border-[var(--accent-base)] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm outline-none focus:border-[var(--accent-base)] transition-colors">
                  <option value="1">Low</option>
                  <option value="2">Medium</option>
                  <option value="3">High</option>
                  <option value="5">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Earliest Start</label>
                <input 
                  type="datetime-local" 
                  value={earliestStart} 
                  onChange={e => {
                    setEarliestStart(e.target.value);
                    // Auto-push deadline if it becomes earlier than start
                    if (new Date(e.target.value) >= new Date(deadline)) {
                      setDeadline(new Date(new Date(e.target.value).getTime() + parseInt(duration) * 60000 + 3600000).toISOString().slice(0, 16));
                    }
                  }} 
                  required 
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm outline-none focus:border-[var(--accent-base)] transition-colors" 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Deadline</label>
                <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} required className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm outline-none focus:border-[var(--accent-base)] transition-colors" />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost py-2 px-4 text-sm">Cancel</button>
                <button type="submit" className="btn-primary py-2 px-4 text-sm">Create Task</button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-sm">
          {tasks.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-slate-300" />
              </div>
              <h3 className="font-bold text-[var(--text-main)] mb-1">Your backlog is empty</h3>
              <p className="text-sm text-[var(--text-muted)]">Create tasks to allow the autonomous engine to schedule them.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {tasks.map(task => (
                <div key={task.id} className={`p-4 flex items-center gap-4 hover:bg-[var(--bg-hover)] transition-colors ${task.status === 'completed' ? 'opacity-50' : ''}`}>
                  <button onClick={() => toggleStatus(task)} className="text-[var(--text-muted)] hover:text-[var(--accent-base)] transition-colors shrink-0">
                    {task.status === 'completed' ? <CheckCircle2 size={22} className="text-green-500" /> : <Circle size={22} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-[var(--text-main)] truncate ${task.status === 'completed' ? 'line-through' : ''}`}>{task.name}</p>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-1">
                      <span className="flex items-center gap-1"><Clock size={12} /> {task.duration_minutes}m</span>
                      <span className="flex items-center gap-1"><CalendarIcon size={12} /> Deadline: {formatDateIST(task.deadline)}</span>
                      {task.status === 'scheduled' && task.scheduled_start && (
                        <span className="bg-blue-100 text-blue-700 px-2 rounded-full font-bold">
                          📅 {formatIST(task.scheduled_start)} IST
                        </span>
                      )}
                      {task.priority >= 3 && <span className="text-red-500 font-bold">High Priority</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2 shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
