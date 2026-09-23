import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { Plus, Clock, Calendar as CalendarIcon, CheckCircle2, Circle, Trash2, Wand2, Lock, Zap, MonitorOff, Monitor } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { localInputToIST, defaultLocalValue, formatIST, formatDateIST } from '../utils/time';
import { Section, Row } from '../components/ui/LayoutBlocks';

export default function Tasks() {
  const { token } = useAuth();
  const { tasks, loadingTasks, addTask, updateTask, deleteTask } = useTasks();
  const [showForm, setShowForm] = useState(() => sessionStorage.getItem('taskpulse_showform') === 'true');

  const toggleForm = () => {
    setShowForm(prev => {
      const next = !prev;
      sessionStorage.setItem('taskpulse_showform', next);
      return next;
    });
  };

  const location = useLocation();

  useEffect(() => {
    if (location.hash && !loadingTasks && tasks.length > 0) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-[var(--accent-base)]', 'bg-opacity-20', 'transition-all', 'duration-1000');
          setTimeout(() => {
            element.classList.remove('bg-[var(--accent-base)]', 'bg-opacity-20');
          }, 2000);
        }, 100);
      }
    }
  }, [location.hash, loadingTasks, tasks.length]);

  // Form State
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(60);
  const [taskType, setTaskType] = useState('flexible'); // 'flexible' or 'fixed'
  const [earliestStart, setEarliestStart] = useState(() => defaultLocalValue(60000)); // 1 min from now
  const [deadline, setDeadline] = useState(() => defaultLocalValue(86400000 * 2));    // 2 days from now
  const [priority, setPriority] = useState(1);
  const [reminders, setReminders] = useState([]);
  const [isScreenFree, setIsScreenFree] = useState(false);

  const handleReminderToggle = (mins) => {
    setReminders(prev => prev.includes(mins) ? prev.filter(m => m !== mins) : [...prev, mins]);
  };

  const overlappingTask = useMemo(() => {
    if (taskType !== 'fixed') return null;
    if (!earliestStart || !duration) return null;

    const draftStart = new Date(earliestStart).getTime();
    const draftEnd = draftStart + parseInt(duration) * 60000;

    return tasks.find(t => {
      if (!t.fixed || t.status === 'completed' || t.status === 'missed') return false;
      const tStart = new Date(t.earliest_start || t.scheduled_start).getTime();
      const tEnd = tStart + (t.duration_minutes * 60000);
      return draftStart < tEnd && draftEnd > tStart;
    });
  }, [taskType, earliestStart, duration, tasks]);

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
      reminders: reminders,
      is_screen_free: isScreenFree
    });
    sessionStorage.setItem('taskpulse_showform', 'false');
    setShowForm(false);
    setName('');
    setTaskType('flexible');
    setEarliestStart(defaultLocalValue(60000));
    setDeadline(defaultLocalValue(86400000 * 2));
    setReminders([]);
    setIsScreenFree(false);
  };

  const toggleStatus = (task) => {
    updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
  };

  const [filter, setFilter] = useState('all');

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return task.status === 'pending';
    if (filter === 'scheduled') return task.status === 'scheduled';
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'missed') return task.status === 'missed';
    if (filter === 'fixed') return task.fixed === true;
    return true;
  });

  if (loadingTasks && tasks.length === 0) return <div className="p-10 text-center text-[var(--text-muted)]">Loading tasks...</div>;

  return (
    <div className="bg-[var(--bg-app)] pb-24 lg:pb-12 pt-4 lg:pt-8 min-h-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        <div data-tour="tasks-header" className="flex items-center justify-between mb-6 scroll-mt-24">
          <h1 className="text-3xl font-bold text-[var(--text-main)]">Tasks</h1>
          <button onClick={toggleForm} className="btn-primary py-2 px-4 rounded-full flex items-center gap-1.5 text-sm">
            <Plus size={16} /> New Task
          </button>
        </div>

        {showForm && (
          <form onSubmit={createTask} className="mb-8">
            <Section title="Create New Task">
              {/* Task Mode Selector */}
              <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                <label className="block text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Task Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTaskType('flexible')}
                    className={`p-3 rounded-xl border text-left transition-all ${taskType === 'flexible'
                        ? 'border-[var(--accent-base)] bg-[var(--accent-light)] ring-2 ring-[var(--accent-base)]/20'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                      }`}
                  >
                    <p className="font-bold text-sm text-[var(--text-main)] flex items-center gap-1.5"><Wand2 size={16} className="text-[var(--accent-base)]" /> Flexible</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">AI auto-schedules</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaskType('fixed')}
                    className={`p-3 rounded-xl border text-left transition-all ${taskType === 'fixed'
                        ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                      }`}
                  >
                    <p className="font-bold text-sm text-[var(--text-main)] flex items-center gap-1.5"><Lock size={16} className="text-amber-500" /> Fixed</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">Exact meeting time</p>
                  </button>
                </div>
              </div>

              {/* Form Inputs inside Row-like structure */}
              <div className="px-4 py-3 flex flex-col gap-1 border-b border-[var(--border-subtle)]">
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Task Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-transparent text-[15px] text-[var(--text-main)] outline-none" placeholder="e.g., Team Sync Meeting" />
              </div>

              <div className="px-4 py-3 flex flex-col gap-1 border-b border-[var(--border-subtle)]">
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Duration (mins)</label>
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)} required min="15" step="15" className="w-full bg-transparent text-[15px] text-[var(--text-main)] outline-none" />
              </div>

              <div className="px-4 py-3 flex flex-col gap-1 border-b border-[var(--border-subtle)]">
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-transparent text-[15px] text-[var(--text-main)] outline-none appearance-none cursor-pointer">
                  <option value="1">Low</option>
                  <option value="2">Medium</option>
                  <option value="3">High</option>
                  <option value="5">Critical</option>
                </select>
              </div>

              <div className="px-4 py-3 flex flex-col gap-1 border-b border-[var(--border-subtle)]">
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">{taskType === 'fixed' ? 'Exact Start Time' : 'Earliest Start'}</label>
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
                  className="w-full bg-transparent text-[15px] text-[var(--text-main)] outline-none"
                />
              </div>

              {taskType === 'flexible' && (
                <div className="px-4 py-3 flex flex-col gap-1 border-b border-[var(--border-subtle)]">
                  <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase">Deadline</label>
                  <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} required className="w-full bg-transparent text-[15px] text-[var(--text-main)] outline-none" />
                </div>
              )}

              <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase mb-2">Reminders</label>
                <div className="flex flex-wrap gap-2">
                  {[5, 15, 30].map(mins => (
                    <div
                      key={mins}
                      onClick={() => handleReminderToggle(mins)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors border ${reminders.includes(mins)
                          ? 'bg-[var(--accent-base)] text-white border-[var(--accent-base)]'
                          : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                        }`}
                    >
                      {mins}m before
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
                <div>
                  <label className="block text-[13px] font-bold text-[var(--text-main)] mb-0.5">Screen-Free Task</label>
                  <p className="text-[11px] text-[var(--text-muted)]">Block phone usage completely during this task</p>
                </div>
                <div 
                  className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors ${isScreenFree ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                  onClick={() => setIsScreenFree(!isScreenFree)}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isScreenFree ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>

              {overlappingTask && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[13px] flex gap-2">
                  <span className="text-base leading-none">⚠️</span>
                  <div>
                    <strong>Conflict:</strong> Overlaps with fixed event "<strong>{overlappingTask.name}</strong>". Select another time.
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="p-2 bg-[var(--bg-panel)] flex gap-2">
                <button type="button" onClick={toggleForm} className="flex-1 py-3 text-[15px] font-semibold text-[var(--text-muted)] bg-[var(--bg-app)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors">Cancel</button>
                <button type="submit" disabled={!!overlappingTask} className="flex-1 py-3 text-[15px] font-semibold text-white bg-[var(--accent-base)] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                  {taskType === 'fixed' ? 'Save Fixed Event' : 'Create Task'}
                </button>
              </div>
            </Section>
          </form>
        )}

        {/* Backlog Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: `All (${tasks.length})` },
            { id: 'pending', label: `Pending (${tasks.filter(t => t.status === 'pending').length})` },
            { id: 'scheduled', label: `Scheduled (${tasks.filter(t => t.status === 'scheduled').length})` },
            { id: 'completed', label: `Completed (${tasks.filter(t => t.status === 'completed').length})` },
            { id: 'fixed', label: <span className="flex items-center gap-1.5"><Lock size={12} /> Fixed ({tasks.filter(t => t.fixed).length})</span> },
            ...(tasks.some(t => t.status === 'missed') ? [{ id: 'missed', label: `⛔ Missed (${tasks.filter(t => t.status === 'missed').length})` }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${filter === tab.id
                  ? 'bg-[var(--accent-base)] text-white'
                  : 'bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task List */}
        <Section>
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center bg-[var(--bg-panel)]">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center mb-3">
                <CheckCircle2 size={24} className="text-[var(--text-muted)]" />
              </div>
              <h3 className="font-bold text-[var(--text-main)] mb-1">No tasks in this view</h3>
              <p className="text-[13px] text-[var(--text-muted)]">Select another filter tab or create a new task above.</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <Row
                key={task.id}
                icon={task.status === 'completed' ? CheckCircle2 : task.status === 'missed' ? Circle : Circle}
                iconColor={task.status === 'completed' ? 'text-green-500 bg-transparent' : 'text-[var(--text-muted)] bg-transparent'}
                title={<span className={task.status === 'completed' || task.status === 'missed' ? 'line-through text-[var(--text-muted)] opacity-70' : ''}>{task.name}</span>}
                onClick={() => toggleStatus(task)}
                right={
                  <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                }
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--text-muted)] mt-1">
                  <span className="flex items-center gap-1 bg-[var(--bg-app)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md"><Clock size={10} /> {task.duration_minutes}m</span>

                  {!task.fixed && <span className="flex items-center gap-1 bg-[var(--bg-app)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md"><CalendarIcon size={10} /> {formatDateIST(task.deadline)}</span>}
                  
                  {task.is_screen_free ? (
                    <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md uppercase tracking-wide border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-1"><MonitorOff size={10} /> Screen-Free</span>
                  ) : (
                    <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wide border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1"><Monitor size={10} /> On-Screen</span>
                  )}

                  {task.status === 'missed' && (
                    <span className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-md uppercase tracking-wide">
                      ⛔ Missed
                    </span>
                  )}

                  {task.status !== 'missed' && task.fixed && (
                    <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1">
                      <Lock size={10} /> Fixed ({formatIST(task.scheduled_start || task.earliest_start)})
                    </span>
                  )}

                  {!task.fixed && task.status === 'scheduled' && task.scheduled_start && (
                    <span className="bg-indigo-50 dark:bg-indigo-500/10 text-[var(--accent-base)] px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1">
                      <Zap size={10} /> {formatIST(task.scheduled_start)} IST
                    </span>
                  )}

                  {task.priority >= 3 && (
                    <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md uppercase tracking-wide">
                      High Priority
                    </span>
                  )}
                </div>
              </Row>
            ))
          )}
        </Section>

      </div>
    </div>
  );
}
