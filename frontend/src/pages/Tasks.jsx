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
  const [taskType, setTaskType] = useState('flexible'); // 'flexible' or 'fixed'
  const [earliestStart, setEarliestStart] = useState(() => defaultLocalValue(60000)); // 1 min from now
  const [deadline, setDeadline] = useState(() => defaultLocalValue(86400000 * 2));    // 2 days from now
  const [priority, setPriority] = useState(1);
  const [reminders, setReminders] = useState([]);

  const handleReminderToggle = (mins) => {
    setReminders(prev => prev.includes(mins) ? prev.filter(m => m !== mins) : [...prev, mins]);
  };

  const createTask = async (e) => {
    e.preventDefault();
    const isFixed = taskType === 'fixed';
    await addTask({
      name,
      duration_minutes: parseInt(duration),
      earliest_start: localInputToIST(earliestStart),
      deadline: isFixed ? localInputToIST(earliestStart) : localInputToIST(deadline),
      priority: parseInt(priority),
      fixed: isFixed,
      reminders: reminders
    });
    setShowForm(false);
    setName('');
    setTaskType('flexible');
    setEarliestStart(defaultLocalValue(60000));
    setDeadline(defaultLocalValue(86400000 * 2));
    setReminders([]);
  };

  const toggleStatus = (task) => {
    updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
  };

  const [filter, setFilter] = useState('all');

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return task.status === 'pending';
    if (filter === 'scheduled') return task.status === 'scheduled';
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'fixed') return task.fixed === true;
    return true;
  });

  if (loadingTasks && tasks.length === 0) return <div className="p-10 text-center text-[var(--text-muted)]">Loading tasks...</div>;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Tasks & Projects Studio</h1>
            <p className="text-sm text-[var(--text-muted)]">Manage your backlog, filter task modes, and feed the scheduling engine</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowForm(!showForm)} className="btn-primary py-2.5 px-5 flex items-center gap-2 text-sm">
              <Plus size={16} /> New Task
            </button>
          </div>
        </div>

        {showForm && (
        <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 mb-6 shadow-sm">
            <h2 className="font-bold text-[var(--text-main)] mb-4">Create New Task</h2>
            <form onSubmit={createTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Task Mode / Type Selector */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-2 uppercase">Task Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTaskType('flexible')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      taskType === 'flexible'
                        ? 'border-[var(--accent-base)] bg-[var(--accent-light)]/40 ring-2 ring-[var(--accent-base)]/20'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-muted)]'
                    }`}
                  >
                    <p className="font-bold text-sm text-[var(--text-main)]">🤖 AI Flexible Task</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">AI automatically picks the best time slot before deadline</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaskType('fixed')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      taskType === 'fixed'
                        ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-muted)]'
                    }`}
                  >
                    <p className="font-bold text-sm text-[var(--text-main)]">🔒 Fixed Event / Meeting</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Locked to exact start time. AI schedules other tasks around it</p>
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Task Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm outline-none focus:border-[var(--accent-base)] transition-colors" placeholder="e.g., Team Sync Meeting or Write Report" />
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
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">
                  {taskType === 'fixed' ? 'Exact Event Start Time' : 'Earliest Start'}
                </label>
                <input
                  type="datetime-local"
                  value={earliestStart}
                  onChange={e => {
                    setEarliestStart(e.target.value);
                    if (new Date(localInputToIST(e.target.value)) >= new Date(localInputToIST(deadline))) {
                      const earliestStartDate = new Date(localInputToIST(e.target.value));
                      const newTimestamp = earliestStartDate.getTime() + parseInt(duration) * 60000 + 3600000;
                      const newDateISTISO = new Date(newTimestamp).toISOString();
                      const newDeadlineLocal = newDateISTISO.slice(0, 16);
                      setDeadline(newDeadlineLocal);
                    }
                  }}
                  required
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm outline-none focus:border-[var(--accent-base)] transition-colors"
                />
              </div>

              {taskType === 'flexible' && (
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase">Deadline</label>
                  <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} required className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm outline-none focus:border-[var(--accent-base)] transition-colors" />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-2 uppercase">Reminders</label>
                <div className="flex gap-2">
                  {[5, 15, 30].map(mins => (
                    <div
                      key={mins}
                      onClick={() => handleReminderToggle(mins)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors border ${
                        reminders.includes(mins)
                          ? 'bg-[var(--accent-base)] text-white border-[var(--accent-base)]'
                          : 'bg-transparent text-[var(--text-muted)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {mins} min before
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost py-2 px-4 text-sm">Cancel</button>
                <button type="submit" className="btn-primary py-2 px-4 text-sm">
                  {taskType === 'fixed' ? '🔒 Save Fixed Event' : '🤖 Create Flexible Task'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Backlog Filter Tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { id: 'all', label: `All Tasks (${tasks.length})` },
            { id: 'pending', label: `Pending (${tasks.filter(t => t.status === 'pending').length})` },
            { id: 'scheduled', label: `Scheduled (${tasks.filter(t => t.status === 'scheduled').length})` },
            { id: 'completed', label: `Completed (${tasks.filter(t => t.status === 'completed').length})` },
            { id: 'fixed', label: `🔒 Fixed Meetings (${tasks.filter(t => t.fixed).length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-[var(--accent-base)] text-white shadow-sm'
                  : 'bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-sm">
          {filteredTasks.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-slate-300" />
              </div>
              <h3 className="font-bold text-[var(--text-main)] mb-1">No tasks in this view</h3>
              <p className="text-sm text-[var(--text-muted)]">Select another filter tab or create a new task above.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {filteredTasks.map(task => (
                <div key={task.id} className={`p-4 flex items-center gap-4 hover:bg-[var(--bg-hover)] transition-colors ${task.status === 'completed' ? 'opacity-50' : ''}`}>
                  <button onClick={() => toggleStatus(task)} className="text-[var(--text-muted)] hover:text-[var(--accent-base)] transition-colors shrink-0">
                    {task.status === 'completed' ? <CheckCircle2 size={22} className="text-green-500" /> : <Circle size={22} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-[var(--text-main)] truncate ${task.status === 'completed' ? 'line-through' : ''}`}>{task.name}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] mt-1">
                      <span className="flex items-center gap-1"><Clock size={12} /> {task.duration_minutes}m</span>
                      {!task.fixed && <span className="flex items-center gap-1"><CalendarIcon size={12} /> Deadline: {formatDateIST(task.deadline)}</span>}
                      {task.fixed && (
                        <span className="bg-amber-50 text-amber-600 border border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold whitespace-nowrap shadow-sm">
                          Fixed Event ({formatIST(task.scheduled_start || task.earliest_start)})
                        </span>
                      )}
                      {!task.fixed && task.status === 'scheduled' && task.scheduled_start && (
                        <span className="bg-indigo-50 text-indigo-600 border border-indigo-200/80 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold whitespace-nowrap shadow-sm">
                          {formatIST(task.scheduled_start)} IST
                        </span>
                      )}
                      {task.priority >= 3 && (
                        <span className="bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold whitespace-nowrap shadow-sm">
                          High Priority
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="text-[var(--text-muted)] opacity-50 hover:opacity-100 hover:text-red-500 transition-all p-2 shrink-0">
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
