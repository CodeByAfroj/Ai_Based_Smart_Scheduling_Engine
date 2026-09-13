import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { Play, Calendar as CalendarIcon, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { nowIST, formatIST, formatDateIST } from '../utils/time';

export default function Schedule() {
  const { token, API_BASE } = useAuth();
  const { tasks, loadingTasks: loading, fetchTasks } = useTasks();
  const [scheduling, setScheduling] = useState(false);
  const [result, setResult] = useState(null);

  // We want to sort the global tasks for display on this page
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.scheduled_start && b.scheduled_start) return new Date(a.scheduled_start) - new Date(b.scheduled_start);
    if (a.scheduled_start) return -1;
    if (b.scheduled_start) return 1;
    return 0;
  });

  const runEngine = async () => {
    setScheduling(true);
    setResult(null);
    try {
      // Collect tasks that need scheduling (pending or already scheduled, skip completed)
      const tasksToSchedule = tasks.filter(t => t.status !== 'completed').map(t => ({
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tasks: tasksToSchedule,
          fixed_events: [],
          working_hours: { start_hour: 9, end_hour: 18 },
          reference_time: nowIST()
        })
      });
      
      const data = await res.json();
      setResult(data);
      // Re-fetch tasks globally to update all views with new schedule
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
    <div className="min-h-screen bg-[var(--bg-app)] p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Schedule & Timeline</h1>
            <p className="text-sm text-[var(--text-muted)]">AI-orchestrated time blocks based on your workload</p>
          </div>
          <button onClick={runEngine} disabled={scheduling} className="btn-primary py-3 px-6 flex items-center gap-2 font-bold shadow-lg shrink-0">
            {scheduling ? (
              <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Engine Running...</span>
            ) : (
              <><Play size={18} fill="currentColor" /> Run Auto-Scheduler</>
            )}
          </button>
        </div>

        {result && (
          <div className={`p-4 rounded-xl mb-8 flex items-start gap-3 border ${result.status === 'OPTIMAL' || result.status === 'FEASIBLE' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {result.status === 'OPTIMAL' || result.status === 'FEASIBLE' ? <CheckCircle2 size={24} className="shrink-0" /> : <AlertTriangle size={24} className="shrink-0" />}
            <div>
              <h3 className="font-bold mb-1">Engine Result: {result.status}</h3>
              <p className="text-sm opacity-80">{result.message} (Solved in {result.solve_time_ms.toFixed(2)}ms)</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
          <h2 className="font-bold text-[var(--text-main)] mb-6 flex items-center gap-2"><CalendarIcon size={18} className="text-[var(--accent-base)]" /> Upcoming Timeline</h2>
          
          <div className="relative border-l-2 border-slate-200 ml-3 pl-6 space-y-6">
            {sortedTasks.filter(t => t.scheduled_start).length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">No tasks are scheduled yet. Create tasks in the backlog and click Run Auto-Scheduler.</p>
            ) : (
              sortedTasks.filter(t => t.scheduled_start).map(task => {
                return (
                  <div key={task.id} className="relative">
                    {/* Timeline dot */}
                    <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-4 border-white ${task.status === 'completed' ? 'bg-slate-300' : 'bg-[var(--accent-base)]'}`}></div>
                    
                    <div className={`p-4 rounded-xl border border-[var(--border-subtle)] ${task.status === 'completed' ? 'bg-slate-50 opacity-60' : 'bg-white hover:border-[var(--accent-light)]'} transition-colors`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                            {formatDateIST(task.scheduled_start)}
                          </p>
                          <h3 className={`font-bold text-lg ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-[var(--text-main)]'}`}>{task.name}</h3>
                        </div>
                        <div className="text-right shrink-0 bg-indigo-50 text-[var(--accent-base)] px-3 py-1.5 rounded-lg border border-indigo-100">
                          <p className="font-bold text-sm flex items-center gap-1"><Clock size={14} /> {formatIST(task.scheduled_start)}</p>
                          <p className="text-xs opacity-70 text-center">to {formatIST(task.scheduled_end)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
