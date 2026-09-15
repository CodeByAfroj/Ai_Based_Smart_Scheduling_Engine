import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import {
  Bell, CheckCircle2, Clock, Calendar, ArrowRight, Plus,
  RefreshCcw, Zap, BarChart3, ChevronRight, AlarmClock,
  Circle, Trash2, Play
} from 'lucide-react';
import { formatIST, formatDateIST, nowIST } from '../utils/time'

export default function Dashboard() {
  const { profile, readinessScore, token } = useAuth();
  const { tasks, loadingTasks: loading, updateTask, deleteTask } = useTasks();
  const navigate = useNavigate();
  const [notifDismissed, setNotifDismissed] = useState(false);

  const firstName = profile?.name?.split(' ')[0] || 'there';
  const profileIncomplete = readinessScore < 100;

  // Derived stats from real tasks
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const scheduledTasks = tasks.filter(t => t.status === 'scheduled');
  const todayTasks = tasks.filter(t => {
    if (!t.scheduled_start) return false;
    return formatDateIST(t.scheduled_start) === formatDateIST(nowIST());
  });
  const totalFocusMinutes = completedTasks.reduce((acc, t) => acc + (t.duration_minutes || 0), 0);
  const activeTasks = tasks.filter(t => t.status !== 'completed');

  const toggleStatus = (task) => {
    updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
  };

  const removeTask = (id) => {
    deleteTask(id);
  };

  const getPriorityLabel = (p) => {
    if (p >= 5) return { text: 'Critical', cls: 'bg-red-100 text-red-700' };
    if (p >= 3) return { text: 'High Priority', cls: 'bg-red-100 text-red-700' };
    if (p >= 2) return { text: 'Medium', cls: 'bg-amber-100 text-amber-700' };
    return { text: 'Low', cls: 'bg-slate-100 text-slate-600' };
  };

  const [recommendation, setRecommendation] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoadingRec(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/recommendations/next-task`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setRecommendation(data))
      .catch(err => console.error('Rec error', err))
      .finally(() => setLoadingRec(false));
  }, [token, tasks]);

  const recTask = recommendation?.recommended_next_task;
  const dateStr = new Date(nowIST()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Top Alert Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-3 flex items-center gap-4">
        <div className="bg-white/10 rounded-lg p-2 shrink-0">
          <AlarmClock size={18} className="text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-bold text-sm">Welcome back, {firstName}!</span>
            <span className="text-amber-400 text-xs font-bold">
              {activeTasks.length} Task{activeTasks.length !== 1 ? 's' : ''} Active
              {todayTasks.length > 0 && ` • ${todayTasks.length} Scheduled Today`}
            </span>
          </div>
          <p className="text-white/60 text-xs">
            {scheduledTasks.length > 0
              ? `You have ${scheduledTasks.length} scheduled task${scheduledTasks.length !== 1 ? 's' : ''}. Head to the Schedule tab to view your timeline.`
              : pendingTasks.length > 0
                ? `${pendingTasks.length} pending task${pendingTasks.length !== 1 ? 's' : ''} waiting to be scheduled. Use the Schedule tab to run the engine.`
                : 'Create your first task to get started with intelligent scheduling.'
            }
          </p>
        </div>
        <button onClick={() => navigate('/schedule')} className="hidden lg:flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shrink-0">
          View Timeline & Focus Blocks <ArrowRight size={14} />
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">

            {/* AI Personalized Recommendation Card */}
            {recommendation && recTask && (
              <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-2xl p-6 mb-6 shadow-md border border-indigo-700/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Zap size={180} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <Zap size={12} /> Personalized Recommendation
                      </span>
                      <span className="bg-white/10 text-white/90 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-white/10">
                        {recommendation.current_energy_level}
                      </span>
                    </div>
                    <span className="text-xs text-indigo-200 font-mono">Score: {recTask.score} pts</span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1">{recTask.name}</h3>
                  <p className="text-indigo-200 text-xs mb-4 leading-relaxed">{recTask.reason_detail}</p>

                  <div className="flex items-center justify-between flex-wrap gap-3 bg-white/10 rounded-xl p-3.5 border border-white/10">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5 font-medium"><Clock size={14} className="text-amber-400"/> {recTask.duration_minutes} mins</span>
                      <span className="bg-indigo-500/30 text-indigo-100 px-2 py-0.5 rounded font-medium">{recTask.reason_badge}</span>
                      <span className="text-indigo-200">Recommended: <strong>{recTask.recommended_time_slot}</strong></span>
                    </div>
                    <button onClick={() => navigate('/schedule')} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                      Start Task <Play size={12} fill="currentColor" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Completion Banner */}
            {!notifDismissed && profileIncomplete && (
              <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6 mb-6 flex flex-col lg:flex-row gap-5">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-[var(--accent-base)] p-3 rounded-xl shrink-0">
                    <Bell size={24} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Setup Incomplete</p>
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Recommended</span>
                    </div>
                    <h2 className="text-xl lg:text-2xl font-bold text-[var(--text-main)] mb-2 leading-tight">Complete your workspace to unlock smart scheduling</h2>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-4">
                      Your workspace is {readinessScore}% ready. Complete your profile preferences — timezone, work hours, notifications, and categories — to enable TaskPulse's autonomous scheduling engine.
                    </p>
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 size={16} />
                        <span className="font-medium">Push alerts & audio chime 15m prior to task start</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 size={16} />
                        <span className="font-medium">Daily Morning Schedule Briefing at 8:30 AM</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-row lg:flex-col gap-3 lg:justify-center shrink-0">
                  <button onClick={() => navigate('/profile-setup')} className="btn-primary py-3 px-5 text-sm flex items-center gap-2 whitespace-nowrap">
                    <Bell size={16} /> Complete Profile Setup
                  </button>
                  <button onClick={() => setNotifDismissed(true)} className="btn-ghost py-3 px-5 text-sm whitespace-nowrap">
                    Maybe Later
                  </button>
                </div>
              </div>
            )}

            {/* Task List Header - Today's Focus Agenda */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-main)]">Today's Focus & Priority Actions</h2>
                <p className="text-xs text-[var(--text-muted)]">Key time-blocked sessions and high priority focus items for today</p>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Calendar size={14} /> {dateStr}</span>
                <button onClick={() => navigate('/tasks')} className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
                  <Plus size={16} /> New Task
                </button>
              </div>
            </div>

            {/* Task List - Filtered for Today & Key Priorities */}
            {loading ? (
              <div className="text-center py-10 text-[var(--text-muted)]">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-10 text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-indigo-300" />
                </div>
                <h3 className="font-bold text-[var(--text-main)] mb-2">No tasks yet</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">Create tasks in the Tasks tab, then run the AI scheduler to assign time blocks.</p>
                <button onClick={() => navigate('/tasks')} className="btn-primary py-2.5 px-5 text-sm inline-flex items-center gap-2">
                  <Plus size={16} /> Create Your First Task
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {(todayTasks.length > 0 ? todayTasks : activeTasks.slice(0, 4)).map(task => {
                  const pri = getPriorityLabel(task.priority || 1);
                  const isComplete = task.status === 'completed';
                  const isScheduled = task.status === 'scheduled';
                  return (
                    <div key={task.id} className={`bg-white rounded-2xl border border-[var(--border-subtle)] border-l-4 ${isComplete ? 'border-l-green-400 opacity-60' : isScheduled ? 'border-l-blue-400' : 'border-l-[var(--accent-base)]'} p-5 shadow-sm transition-opacity`}>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pri.cls}`}>
                          ● {pri.text}
                        </span>
                        {isScheduled && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            Scheduled
                          </span>
                        )}
                        {isComplete && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            ✓ Completed
                          </span>
                        )}
                        <span className="ml-auto text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                          <Clock size={10} /> {task.duration_minutes}m
                          {task.scheduled_start && (
                            <> • {new Date(task.scheduled_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} – {new Date(task.scheduled_end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</>
                          )}
                        </span>
                      </div>

                      <h3 className={`font-bold text-[var(--text-main)] text-base mb-2 leading-snug ${isComplete ? 'line-through' : ''}`}>{task.name}</h3>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4">
                        Deadline: {new Date(task.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="ml-auto flex items-center gap-2">
                          <button onClick={() => toggleStatus(task)} className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border transition-colors ${isComplete ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-[var(--accent-light)] text-[var(--accent-base)] border-[var(--accent-base)] hover:bg-indigo-100'}`}>
                            <CheckCircle2 size={14} /> {isComplete ? 'Undo' : 'Mark Done'}
                          </button>
                          <button onClick={() => removeTask(task.id)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Direct Link to Full Backlog */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between text-xs">
                  <span className="text-indigo-900 font-medium">Viewing today's active focus items. Manage full backlog & projects ({tasks.length} total)</span>
                  <Link to="/tasks" className="text-[var(--accent-base)] font-bold flex items-center gap-1 hover:underline">
                    Tasks Studio <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="hidden lg:flex flex-col gap-6 w-72 xl:w-80 shrink-0">
            {/* Workspace Readiness */}
            <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">Account Setup</p>
                  <h3 className="font-bold text-[var(--text-main)]">Workspace Readiness</h3>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  readinessScore === 100 ? 'bg-green-100 text-green-700' :
                  readinessScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>{readinessScore === 100 ? 'Complete' : readinessScore >= 50 ? 'Intermediate' : 'Getting Started'}</span>
              </div>

              <div className="flex items-center gap-4 my-5">
                <div className="relative w-20 h-20 shrink-0">
                  <svg viewBox="0 0 80 80" className="w-20 h-20">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#e0e7ff" strokeWidth="7"/>
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#4338ca" strokeWidth="7"
                      strokeDasharray={213.6} strokeDashoffset={213.6 * (1 - readinessScore / 100)}
                      strokeLinecap="round" transform="rotate(-90 40 40)"
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-[var(--text-main)]">{readinessScore}%</span>
                  </div>
                </div>
                <div>
                  {readinessScore < 100 && (
                    <>
                      <p className="text-green-600 font-bold text-sm mb-1">+{Math.round((100 - readinessScore) * 0.35)}% efficiency boost available</p>
                      <p className="text-xs text-[var(--text-muted)] leading-snug">Complete notifications, calendar sync, and work hour boundaries.</p>
                    </>
                  )}
                  {readinessScore === 100 && (
                    <p className="text-green-600 font-bold text-sm">All systems configured! ✓</p>
                  )}
                </div>
              </div>

              {readinessScore < 100 && (
                <button onClick={() => navigate('/profile-setup')} className="btn-primary w-full text-sm py-3 flex items-center justify-center gap-2">
                  Complete Profile & Preferences <ChevronRight size={16} />
                </button>
              )}
            </div>

            {/* Today's Schedule from Real Data */}
            <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[var(--accent-base)]" />
                  <h3 className="font-bold text-[var(--text-main)]">Today's Timeline</h3>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{todayTasks.length} block{todayTasks.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex flex-col gap-4">
                {todayTasks.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-[var(--text-muted)]">No scheduled blocks today.</p>
                    <button onClick={() => navigate('/schedule')} className="text-xs text-[var(--accent-base)] font-bold mt-2 hover:underline">
                      Run the auto-scheduler →
                    </button>
                  </div>
                ) : (
                  todayTasks.sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start)).map((task, i) => {
                    const start = new Date(task.scheduled_start);
                    const end = new Date(task.scheduled_end);
                    return (
                      <div key={task.id} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 ${i === 0 ? 'bg-[var(--accent-base)] border-[var(--accent-base)]' : 'border-slate-300 bg-white'}`} />
                          {i < todayTasks.length - 1 && <div className="w-0.5 h-8 bg-slate-200 mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[var(--text-muted)]">
                            {start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} – {end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                          </p>
                          <p className="text-sm font-semibold text-[var(--text-main)] truncate">{task.name}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">● {tasks.length} total tasks</span>
                <Link to="/schedule" className="text-[var(--accent-base)] font-bold hover:underline">Full schedule</Link>
              </div>
            </div>

            {/* Stats Row - Real Data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-green-600 mb-2">
                  <CheckCircle2 size={14} />
                  <span className="text-[10px] font-bold uppercase">Completed</span>
                </div>
                <p className="text-2xl font-bold text-[var(--text-main)]">{completedTasks.length}</p>
                <p className="text-[10px] font-bold text-[var(--text-muted)]">Tasks</p>
              </div>
              <div className="bg-white rounded-2xl border border-[var(--border-subtle)] p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-[var(--accent-base)] mb-2">
                  <BarChart3 size={14} />
                  <span className="text-[10px] font-bold uppercase">Focus Time</span>
                </div>
                <p className="text-2xl font-bold text-[var(--text-main)]">{(totalFocusMinutes / 60).toFixed(1)}h</p>
                <p className="text-[10px] font-bold text-[var(--text-muted)]">Logged</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
