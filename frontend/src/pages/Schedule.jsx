import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { Play, Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle2, RotateCcw, Zap } from 'lucide-react';
import { nowIST, formatIST, formatDateIST } from '../utils/time';

export default function Schedule() {
  const { token, API_BASE } = useAuth();
  const { tasks, loadingTasks: loading, fetchTasks, updateTask } = useTasks();
  const [scheduling, setScheduling] = useState(false);
  const [result, setResult] = useState(null);

  const now = new Date();

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.scheduled_start && b.scheduled_start) return new Date(a.scheduled_start) - new Date(b.scheduled_start);
    if (a.scheduled_start) return -1;
    if (b.scheduled_start) return 1;
    return 0;
  });

  // Only future, non-completed, non-missed tasks
  const upcomingTasks = sortedTasks.filter(t =>
    t.scheduled_start &&
    t.status !== 'completed' &&
    t.status !== 'missed' &&
    new Date(t.scheduled_end || t.scheduled_start) > now
  );

  // All tasks waiting for a schedule slot (pending or unscheduled)
  const pendingTasks = tasks.filter(t =>
    t.status === 'pending' ||
    (t.status !== 'completed' && t.status !== 'missed' && !t.scheduled_start)
  );

  const pushTaskTime = async (task) => {
    const updates = {};
    if (task.fixed && task.earliest_start) {
      const dt = new Date(task.earliest_start);
      dt.setDate(dt.getDate() + 1);
      updates.earliest_start = dt.toISOString().slice(0, 16);
    } else if (!task.fixed && task.deadline) {
      const dt = new Date(task.deadline);
      dt.setDate(dt.getDate() + 1);
      updates.deadline = dt.toISOString().slice(0, 16);
    }
    if (Object.keys(updates).length > 0) {
      await updateTask(task.id, updates);
    }
  };

  const runEngine = async () => {
    setScheduling(true);
    setResult(null);
    try {
      const tasksToSchedule = tasks
        .filter(t => {
          if (t.status === 'completed' || t.status === 'missed') return false;
          if (t.fixed && t.earliest_start && new Date(t.earliest_start) < now) return false;
          return true;
        })
        .map(t => ({
          id: t.id,
          name: t.name,
          duration_minutes: t.duration_minutes,
          earliest_start: t.earliest_start,
          deadline: t.deadline,
          priority: t.priority || 1,
          fixed: t.fixed || false
        }));

      const res = await fetch(`${API_BASE}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tasks: tasksToSchedule, fixed_events: [], reference_time: nowIST() })
      });

      const data = await res.json();
      setResult(data);
      fetchTasks(true);
    } catch (err) {
      console.error(err);
      setResult({ status: 'ERROR', message: err.message });
    } finally {
      setScheduling(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-[var(--text-muted)]">Loading schedule...</div>;

  return (
    <div className="bg-[var(--bg-app)] p-6 lg:p-10 pb-32 lg:pb-10 flex-1">
      <div className="max-w-5xl mx-auto">

        <div data-tour="schedule-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 scroll-mt-24">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Schedule &amp; Timeline</h1>
            <p className="text-sm text-[var(--text-muted)]">AI-orchestrated time blocks based on your workload</p>
          </div>
          <button onClick={runEngine} disabled={scheduling} className="btn-primary py-3 px-6 flex items-center gap-2 font-bold shadow-lg shrink-0">
            {scheduling
              ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Engine Running...</span>
              : <><Play size={18} fill="currentColor" /> Run Auto-Scheduler</>}
          </button>
        </div>

        {/* Educational Banner */}
        <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20 rounded-xl p-4 mb-8 flex gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <Zap size={16} />
          </div>
          <div>
            <h3 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm mb-1">Why run the Auto-Scheduler?</h3>
            <p className="text-sm text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed">
              When you create a new task, it is added to your backlog. The <strong>Auto-Scheduler</strong> uses a Google CP-SAT AI engine to automatically analyze your working hours, existing fixed meetings, and task priorities to assign the absolute optimal time slots for your new tasks without double-booking. Run it whenever your workload changes!
            </p>
          </div>
        </div>

        {result && (
          <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 border ${result.status === 'OPTIMAL' || result.status === 'FEASIBLE' ? 'bg-green-50 border-green-200 text-green-800' : result.status === 'ERROR' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            {result.status === 'OPTIMAL' || result.status === 'FEASIBLE' ? <CheckCircle2 size={22} className="shrink-0 mt-0.5" /> : <AlertTriangle size={22} className="shrink-0 mt-0.5" />}
            <div>
              <h3 className="font-bold mb-0.5">{result.status === 'OPTIMAL' || result.status === 'FEASIBLE' ? '✅ Schedule updated!' : result.status === 'ERROR' ? '❌ Error' : `Engine: ${result.status}`}</h3>
              <p className="text-sm opacity-80">{result.message}{result.solve_time_ms !== undefined ? ` (${result.solve_time_ms.toFixed(1)}ms)` : ''}</p>
            </div>
          </div>
        )}

        {/* Needs Scheduling Card */}
        {pendingTasks.length > 0 && (
          <div className="bg-[var(--bg-panel)] border border-orange-200 rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <RotateCcw size={18} className="text-orange-600" />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--text-main)] text-sm leading-tight">
                    {pendingTasks.length} Task{pendingTasks.length > 1 ? 's' : ''} Need{pendingTasks.length === 1 ? 's' : ''} Scheduling
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">Click Auto-Schedule to assign optimal time slots</p>
                </div>
              </div>
              <button
                onClick={runEngine}
                disabled={scheduling}
                className="flex items-center gap-2 bg-[var(--accent-base)] hover:bg-[var(--accent-hover)] text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors shadow-sm shrink-0"
              >
                <Zap size={15} />
                {scheduling ? 'Scheduling…' : 'Auto-Schedule All'}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {pendingTasks.map(task => {
                const isOverdueFixed = task.fixed && task.earliest_start && new Date(task.earliest_start) < now;
                const isOverdueFlex = !task.fixed && task.deadline && new Date(task.deadline) < now;
                const isOverdue = isOverdueFixed || isOverdueFlex;

                return (
                  <div key={task.id} className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-2.5 ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-[var(--bg-hover)] border-[var(--border-subtle)]'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isOverdue ? 'text-red-900' : 'text-[var(--text-main)]'}`}>{task.name}</p>
                        {isOverdue && (
                          <p className="text-[10px] text-red-600 font-bold mt-0.5">
                            ⚠️ Missed {task.fixed ? 'Time' : 'Deadline'}: {formatDateIST(task.fixed ? task.earliest_start : task.deadline)} {formatIST(task.fixed ? task.earliest_start : task.deadline)}
                          </p>
                        )}
                      </div>
                      {!isOverdue && task.fixed && <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">Fixed</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {isOverdue ? (
                        <button onClick={() => pushTaskTime(task)} className="text-[10px] font-bold bg-white text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1 rounded shadow-sm transition-colors">
                          Push +24h
                        </button>
                      ) : (
                        <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                          <Clock size={12} /> {task.duration_minutes}m
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Timeline */}
        <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
          <h2 className="font-bold text-[var(--text-main)] mb-6 flex items-center gap-2">
            <CalendarIcon size={18} className="text-[var(--accent-base)]" /> Upcoming Timeline
          </h2>
          <div className="relative border-l-2 border-slate-200 ml-3 pl-6 space-y-6">
            {upcomingTasks.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <CalendarIcon size={24} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-main)] mb-1">No upcoming tasks</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {pendingTasks.length > 0 ? 'Click "Auto-Schedule All" above to assign time slots.' : 'Create tasks in the backlog and run the scheduler.'}
                </p>
              </div>
            ) : (
              upcomingTasks.map(task => (
                <div key={task.id} className="relative">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-4 border-[var(--bg-panel)] bg-[var(--accent-base)]" />
                  <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-gradient-to-r from-[var(--bg-panel)] to-[var(--bg-app)] hover:border-[var(--accent-light)] shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">{formatDateIST(task.scheduled_start)}</p>
                        <h3 className="font-bold text-lg text-[var(--text-main)]">{task.name}</h3>
                        {task.fixed && <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Fixed Event</span>}
                      </div>
                      <div className="sm:text-right shrink-0 bg-[var(--accent-base)]/10 text-[var(--accent-base)] px-3 py-1.5 rounded-lg border border-[var(--accent-base)]/20 self-start sm:self-auto w-full sm:w-auto mt-1 sm:mt-0">
                        <p className="font-bold text-sm flex items-center justify-start sm:justify-end gap-1"><Clock size={14} /> {formatIST(task.scheduled_start)}</p>
                        <p className="text-xs opacity-70 text-left sm:text-right">to {formatIST(task.scheduled_end)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
