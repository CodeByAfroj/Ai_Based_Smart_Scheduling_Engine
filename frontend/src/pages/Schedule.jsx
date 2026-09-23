import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { Play, Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle2, Zap, Info, SmartphoneOff, Smartphone } from 'lucide-react';
import { nowIST, formatIST, formatDateIST } from '../utils/time';
import { Section } from '../components/ui/LayoutBlocks';

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

  const upcomingTasks = sortedTasks.filter(t =>
    t.scheduled_start &&
    t.status !== 'completed' &&
    t.status !== 'missed' &&
    new Date(t.scheduled_end || t.scheduled_start) > now
  );

  const pendingTasks = tasks.filter(t =>
    t.status === 'pending' ||
    (t.status !== 'completed' && t.status !== 'missed' && !t.scheduled_start)
  );

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
    <div className="bg-[var(--bg-app)] pb-24 lg:pb-12 pt-4 lg:pt-8 min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        <div data-tour="schedule-header" className="flex items-center justify-between mb-6 scroll-mt-24">
          <h1 className="text-3xl font-bold text-[var(--text-main)]">Schedule</h1>
          <button onClick={runEngine} disabled={scheduling} className="btn-primary py-2 px-4 rounded-full flex items-center gap-1.5 text-sm shadow-md">
            {scheduling
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Running...</>
              : <><Play size={16} fill="currentColor" /> Auto-Schedule</>}
          </button>
        </div>

        {/* Status / Educational Section */}
        <Section>
          {result ? (
            <div className={`p-4 flex gap-3 ${result.status === 'OPTIMAL' || result.status === 'FEASIBLE' ? 'text-green-600' : result.status === 'ERROR' ? 'text-red-600' : 'text-amber-600'}`}>
              {result.status === 'OPTIMAL' || result.status === 'FEASIBLE' ? <CheckCircle2 size={24} className="shrink-0 mt-0.5" /> : <AlertTriangle size={24} className="shrink-0 mt-0.5" />}
              <div>
                <h3 className="font-bold mb-0.5 text-[15px]">{result.status === 'OPTIMAL' || result.status === 'FEASIBLE' ? 'Schedule optimized successfully' : result.status === 'ERROR' ? 'Error' : `Engine: ${result.status}`}</h3>
                <p className="text-[13px] opacity-80">{result.message}{result.solve_time_ms !== undefined ? ` (${result.solve_time_ms.toFixed(1)}ms)` : ''}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 flex gap-3 text-[var(--text-main)]">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-hover)] text-[var(--accent-base)] flex items-center justify-center shrink-0">
                <Info size={18} />
              </div>
              <div>
                <h3 className="font-bold text-[15px] mb-1">AI Auto-Scheduler Engine</h3>
                <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                  The Google CP-SAT engine analyzes your active working hours, biometrics, fixed meetings, and task priorities to calculate the optimal time slots for your backlog without double-booking.
                </p>
              </div>
            </div>
          )}
        </Section>

        {/* Needs Scheduling */}
        {pendingTasks.length > 0 && (
          <Section title="Needs Scheduling">
            {pendingTasks.map((task, i) => {
              const isOverdueFixed = task.fixed && task.earliest_start && new Date(task.earliest_start) < now;
              const isOverdueFlex = !task.fixed && task.deadline && new Date(task.deadline) < now;
              const isOverdue = isOverdueFixed || isOverdueFlex;

              return (
                <div key={task.id} className="p-4 flex items-center gap-4 bg-[var(--bg-panel)]">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOverdue ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[15px] font-semibold truncate ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-[var(--text-main)]'}`}>{task.name}</p>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--text-muted)] mt-1">
                      <span className="flex items-center gap-1 bg-[var(--bg-app)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md"><Clock size={10} /> {task.duration_minutes}m</span>
                      {task.fixed && <span className="text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md uppercase tracking-wide border border-amber-200 dark:border-amber-500/20 flex items-center gap-1"><Zap size={10} /> Fixed</span>}
                      {task.is_screen_free ? (
                        <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md uppercase tracking-wide border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-1"><SmartphoneOff size={10} /> Screen-Free</span>
                      ) : (
                        <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wide border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1"><Smartphone size={10} /> On-Screen</span>
                      )}
                      {isOverdue && (
                        <span className="text-red-600 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-md uppercase tracking-wide border border-red-200 dark:border-red-500/20">
                          ⚠️ Missed {task.fixed ? 'Time' : 'Deadline'}: {formatIST(task.fixed ? task.earliest_start : task.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </Section>
        )}

        {/* Upcoming Timeline */}
        <Section title="Upcoming Timeline">
          {upcomingTasks.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center mb-3">
                <CalendarIcon size={24} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--text-main)] mb-1">No upcoming tasks</p>
              <p className="text-[13px] text-[var(--text-muted)] px-4">
                {pendingTasks.length > 0 ? 'Click "Auto-Schedule" above to assign time slots.' : 'Create tasks in the backlog and run the scheduler.'}
              </p>
            </div>
          ) : (
            upcomingTasks.map((task, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === upcomingTasks.length - 1;
              return (
                <div key={task.id} className="relative flex">
                  {/* Timeline Line */}
                  <div className="w-12 shrink-0 flex flex-col items-center pt-5">
                    <div className="w-3 h-3 rounded-full bg-[var(--accent-base)] border-2 border-[var(--bg-panel)] z-10" />
                    {!isLast && <div className="w-0.5 h-full bg-[var(--border-subtle)] -mt-2" />}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 py-4 pr-4 border-b border-[var(--border-subtle)]">
                    <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      {formatDateIST(task.scheduled_start)} • {formatIST(task.scheduled_start)} to {formatIST(task.scheduled_end)}
                    </p>
                    <h3 className="font-bold text-[15px] text-[var(--text-main)]">{task.name}</h3>
                    <div className="flex gap-2">
                      {task.fixed && <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-md">Fixed Event</span>}
                      {task.is_screen_free ? (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-2 py-0.5 rounded-md"><SmartphoneOff size={10} /> Screen-Free</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-md"><Smartphone size={10} /> On-Screen</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </Section>

      </div>
    </div>
  );
}
