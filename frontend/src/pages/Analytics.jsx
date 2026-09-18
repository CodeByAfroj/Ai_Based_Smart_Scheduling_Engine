import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { BarChart3, Activity, Clock, CheckCircle2, TrendingUp, TrendingDown, ListTodo, Calendar } from 'lucide-react';
import { nowIST, formatDateIST } from '../utils/time';

export default function Analytics() {
  const { token } = useAuth();
  const { tasks, loadingTasks: loading } = useTasks();

  if (loading) return <div className="p-10 text-center text-[var(--text-muted)]">Loading analytics...</div>;

  const completed = tasks.filter(t => t.status === 'completed');
  const scheduled = tasks.filter(t => t.status === 'scheduled');
  const pending = tasks.filter(t => t.status === 'pending');
  const totalDuration = tasks.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
  const completedDuration = completed.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
  const completionRate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
  const scheduledRate = tasks.length > 0 ? Math.round((scheduled.length / tasks.length) * 100) : 0;

  // Priority breakdown
  const highPriority = tasks.filter(t => (t.priority || 1) >= 3);
  const highCompleted = highPriority.filter(t => t.status === 'completed');
  const highCompletionRate = highPriority.length > 0 ? Math.round((highCompleted.length / highPriority.length) * 100) : 0;

  // Per-day breakdown for the chart (last 7 days)
const dayLabels = [];
      const dayData = [];
      for (let i = 6; i >= 0; i--) {
        // Calculate date for this day in IST (midnight)
        const istNow = new Date(nowIST());
        istNow.setHours(0, 0, 0, 0);
        istNow.setDate(istNow.getDate() - i);
        const dayStr = istNow.toLocaleDateString('en-US', { weekday: 'short' });
        dayLabels.push(dayStr);
        const dayCompleted = completed.filter(t => {
          const updatedStr = t.updated_at ? t.updated_at : t.created_at;
          return formatDateIST(updatedStr) === formatDateIST(istNow.toISOString());
        });
        dayData.push(dayCompleted.length);
      }
  const maxDay = Math.max(...dayData, 1);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-6 lg:p-10 pb-28 lg:pb-10">
      <div className="max-w-5xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Analytics & Activity</h1>
          <p className="text-sm text-[var(--text-muted)]">Real-time task completion metrics and scheduling performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-muted)] uppercase text-xs tracking-wider">Completion Rate</h3>
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-[var(--text-main)]">{completionRate}%</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{completed.length} of {tasks.length} tasks completed</p>
          </div>

          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-muted)] uppercase text-xs tracking-wider">Focus Time</h3>
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Clock size={16} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-[var(--text-main)]">{(completedDuration / 60).toFixed(1)}h</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{(totalDuration / 60).toFixed(1)}h total across all tasks</p>
          </div>

          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-muted)] uppercase text-xs tracking-wider">Scheduled</h3>
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Calendar size={16} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-[var(--text-main)]">{scheduled.length}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{pending.length} pending • {scheduledRate}% auto-scheduled</p>
          </div>

          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-muted)] uppercase text-xs tracking-wider">High Priority</h3>
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400">
                <Activity size={16} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-[var(--text-main)]">{highCompletionRate}%</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{highCompleted.length} of {highPriority.length} high-priority done</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-[var(--text-main)] flex items-center gap-2"><BarChart3 size={18} className="text-[var(--accent-base)]" /> Tasks Completed (Last 7 Days)</h2>
            <span className="text-xs text-[var(--text-muted)]">{completed.length} total completed</span>
          </div>
          {tasks.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">
              No task data yet. Create and complete tasks to see analytics here.
            </div>
          ) : (
            <>
              <div className="h-48 flex items-end justify-between gap-3 border-b border-l border-slate-200 pb-2 pl-2">
                {dayData.map((val, i) => (
                  <div key={i} className="w-full flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-[var(--text-muted)]">{val}</span>
                    <div
                      className={`w-full rounded-t-md transition-colors ${val > 0 ? 'bg-[var(--accent-base)] hover:bg-indigo-700' : 'bg-slate-100'}`}
                      style={{ height: `${val > 0 ? Math.max((val / maxDay) * 100, 10) : 5}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs font-bold text-[var(--text-muted)]">
                {dayLabels.map((l, i) => <span key={i}>{l}</span>)}
              </div>
            </>
          )}
        </div>

        {/* Task Breakdown Table */}
        <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
          <h2 className="font-bold text-[var(--text-main)] flex items-center gap-2 mb-5"><ListTodo size={18} className="text-[var(--accent-base)]" /> Task Breakdown</h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">No tasks to analyze yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-left py-2 px-3 text-xs font-bold text-[var(--text-muted)] uppercase">Task</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-[var(--text-muted)] uppercase">Duration</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-[var(--text-muted)] uppercase">Priority</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-[var(--text-muted)] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 10).map(task => (
                    <tr key={task.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="py-3 px-3 font-semibold text-[var(--text-main)] truncate max-w-[200px]">{task.name}</td>
                      <td className="py-3 px-3 text-[var(--text-muted)]">{task.duration_minutes}m</td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                          (task.priority || 1) >= 3 ? 'bg-red-100/50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/50' :
                          (task.priority || 1) >= 2 ? 'bg-amber-100/50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50' :
                          'bg-slate-100/50 dark:bg-slate-500/10 text-[var(--text-muted)] border border-[var(--border-subtle)]'
                        }`}>
                          {(task.priority || 1) >= 3 ? 'High' : (task.priority || 1) >= 2 ? 'Medium' : 'Low'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                          task.status === 'completed' ? 'bg-green-100/50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-800/50' :
                          task.status === 'scheduled' ? 'bg-blue-100/50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50' :
                          'bg-slate-100/50 dark:bg-slate-500/10 text-[var(--text-muted)] border border-[var(--border-subtle)]'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
