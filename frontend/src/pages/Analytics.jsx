import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { BarChart3, Activity, Clock, CheckCircle2, ListTodo, Calendar, PieChart as PieChartIcon } from 'lucide-react';
import { nowIST, formatDateIST } from '../utils/time';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const istNow = new Date(nowIST());
    istNow.setHours(0, 0, 0, 0);
    istNow.setDate(istNow.getDate() - i);
    const dayStr = istNow.toLocaleDateString('en-US', { weekday: 'short' });
    
    const dayCompleted = completed.filter(t => {
      const updatedStr = t.updated_at ? t.updated_at : t.created_at;
      return formatDateIST(updatedStr) === formatDateIST(istNow.toISOString());
    });
    
    chartData.push({
      name: dayStr,
      completed: dayCompleted.length
    });
  }

  // Status Distribution for Pie Chart
  const statusData = [
    { name: 'Completed', value: completed.length, color: '#10b981' }, // Emerald 500
    { name: 'Scheduled', value: scheduled.length, color: '#3b82f6' }, // Blue 500
    { name: 'Pending', value: pending.length, color: '#94a3b8' },    // Slate 400
  ].filter(d => d.value > 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] p-3 rounded-xl shadow-lg">
          <p className="font-bold text-[var(--text-main)] mb-1">{label}</p>
          <p className="text-sm text-[var(--accent-base)] font-semibold">
            {payload[0].value} {payload[0].value === 1 ? 'task' : 'tasks'} completed
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-4 sm:p-6 lg:p-10 pb-28 lg:pb-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Analytics & Activity</h1>
          <p className="text-sm text-[var(--text-muted)]">Real-time task completion metrics and scheduling performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-muted)] uppercase text-xs tracking-wider">Completion Rate</h3>
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl sm:text-4xl font-bold text-[var(--text-main)]">{completionRate}%</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{completed.length} of {tasks.length} tasks completed</p>
          </div>

          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-muted)] uppercase text-xs tracking-wider">Focus Time</h3>
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Clock size={16} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl sm:text-4xl font-bold text-[var(--text-main)]">{(completedDuration / 60).toFixed(1)}h</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{(totalDuration / 60).toFixed(1)}h total across all tasks</p>
          </div>

          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-muted)] uppercase text-xs tracking-wider">Scheduled</h3>
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Calendar size={16} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl sm:text-4xl font-bold text-[var(--text-main)]">{scheduled.length}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{pending.length} pending • {scheduledRate}% auto-scheduled</p>
          </div>

          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-muted)] uppercase text-xs tracking-wider">High Priority</h3>
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400">
                <Activity size={16} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl sm:text-4xl font-bold text-[var(--text-main)]">{highCompletionRate}%</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{highCompleted.length} of {highPriority.length} high-priority done</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Bar Chart */}
          <div className="lg:col-span-2 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-[var(--text-main)] flex items-center gap-2"><BarChart3 size={18} className="text-[var(--accent-base)]" /> Tasks Completed (Last 7 Days)</h2>
            </div>
            {tasks.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm">
                No task data yet. Create and complete tasks to see analytics here.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                    <Bar dataKey="completed" fill="var(--accent-base)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Pie Chart */}
          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-[var(--text-main)] flex items-center gap-2"><PieChartIcon size={18} className="text-[var(--accent-base)]" /> Status Overview</h2>
            </div>
            {tasks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
                No data available.
              </div>
            ) : (
              <div className="flex-1 h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-panel)' }}
                      itemStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Task Breakdown Table */}
        <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-sm overflow-hidden flex flex-col">
          <h2 className="font-bold text-[var(--text-main)] flex items-center gap-2 mb-5"><ListTodo size={18} className="text-[var(--accent-base)]" /> Task Breakdown</h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">No tasks to analyze yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-5 sm:px-0">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <th className="text-left py-3 px-3 text-xs font-bold text-[var(--text-muted)] uppercase whitespace-nowrap">Task</th>
                      <th className="text-left py-3 px-3 text-xs font-bold text-[var(--text-muted)] uppercase whitespace-nowrap">Duration</th>
                      <th className="text-left py-3 px-3 text-xs font-bold text-[var(--text-muted)] uppercase whitespace-nowrap">Priority</th>
                      <th className="text-left py-3 px-3 text-xs font-bold text-[var(--text-muted)] uppercase whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.slice(0, 10).map(task => (
                      <tr key={task.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-3 px-3 font-semibold text-[var(--text-main)]">
                          <div className="truncate max-w-[150px] sm:max-w-[300px]" title={task.name}>{task.name}</div>
                        </td>
                        <td className="py-3 px-3 text-[var(--text-muted)] whitespace-nowrap">{task.duration_minutes}m</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full inline-block ${
                            (task.priority || 1) >= 3 ? 'bg-red-100/50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/50' :
                            (task.priority || 1) >= 2 ? 'bg-amber-100/50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50' :
                            'bg-slate-100/50 dark:bg-slate-500/10 text-[var(--text-muted)] border border-[var(--border-subtle)]'
                          }`}>
                            {(task.priority || 1) >= 3 ? 'High' : (task.priority || 1) >= 2 ? 'Medium' : 'Low'}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full inline-block ${
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
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
