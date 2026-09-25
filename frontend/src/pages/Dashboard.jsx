import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import {
  Bell, CheckCircle2, Circle, Clock, Calendar, ArrowRight,
  Zap, BarChart3, ChevronRight, Play, Moon, RefreshCw
} from 'lucide-react';
import { formatIST, formatDateIST, nowIST } from '../utils/time'
import { Section, Row } from '../components/ui/LayoutBlocks';

export default function Dashboard() {
  const { profile, readinessScore, token } = useAuth();
  const { tasks, loadingTasks: loading, updateTask } = useTasks();
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

  // Priority Inbox: Top 5 most urgent active tasks
  const topPriorityTasks = activeTasks
    .filter(t => !t.fixed) // exclude fixed meetings from action items
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority; // 5 (Critical) comes before 1 (Low)
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
      return 0;
    })
    .slice(0, 5)
    .map((t, index) => {
      let reason = t.priority_reason;
      if (!reason) {
        if (t.priority === 5) reason = "Marked Critical";
        else if (t.priority === 3) reason = "Marked High Priority";
        else if (t.deadline) reason = "Closest Deadline";
        else if (index === 0) reason = "Next Actionable Item";
        else reason = "Standard Priority";
      }
      return { ...t, reason };
    });

  const [recommendation, setRecommendation] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const fetchRecommendation = (forceRefresh = false) => {
    if (!token) return;

    const activeTasksString = tasks.filter(t => t.status !== 'completed').map(t => t.id).sort().join(',');
    const CACHE_KEY = `taskpulse_ai_rec_cache_${activeTasksString}`;
    const CACHE_TTL_MS = 5 * 60 * 1000;

    if (!forceRefresh) {
      try {
        const cachedString = sessionStorage.getItem(CACHE_KEY);
        if (cachedString) {
          const { data, timestamp } = JSON.parse(cachedString);
          if (Date.now() - timestamp < CACHE_TTL_MS) {
            setRecommendation(data);
            return;
          }
        }
      } catch (e) {
        console.warn("Cache read failed", e);
      }
    }

    setLoadingRec(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/recommendations/next-task`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setRecommendation(data);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      })
      .catch(err => console.error('Rec error', err))
      .finally(() => setLoadingRec(false));
  };

  useEffect(() => {
    fetchRecommendation();
  }, [token, tasks]);

  if (loading && (!tasks || tasks.length === 0)) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-amber-400 p-1 animate-pulse shadow-xl shadow-blue-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="TaskPulse" className="w-16 h-16 object-contain animate-pulse" />
            </div>
          </div>
          <div className="absolute -inset-2 rounded-full border-2 border-indigo-500/30 animate-ping opacity-20 pointer-events-none" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-main)] mb-1">Loading TaskPulse Dashboard...</h2>
        <p className="text-xs text-[var(--text-muted)] animate-pulse">Syncing smart schedule engine...</p>
      </div>
    );
  }

  const recTask = recommendation?.recommended_next_task;
  const dateStr = new Date(nowIST()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 pb-28 lg:pb-8" data-tour="dashboard-hero">

        {/* Profile Completion Banner (Full Width) */}
        {!notifDismissed && profileIncomplete && (
          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-6 mb-6 flex flex-col gap-4 shadow-sm">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="bg-[var(--accent-base)] p-2.5 sm:p-3 rounded-xl shrink-0">
                <Bell size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Setup Incomplete</p>
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Recommended</span>
                </div>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-[var(--text-main)] mb-2 leading-tight">Complete your workspace to unlock smart scheduling</h2>
                <p className="text-[var(--text-muted)] text-xs sm:text-sm leading-relaxed">
                  Your workspace is {readinessScore}% ready. Complete your profile preferences — timezone, work hours, notifications, and categories — to enable TaskPulse's autonomous scheduling engine.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 mt-1">
              <button onClick={() => navigate('/profile-setup')} className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 rounded-lg">
                <Bell size={14} /> Complete Setup
              </button>
              <button onClick={() => setNotifDismissed(true)} className="btn-ghost py-2 px-4 text-xs font-semibold rounded-lg">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Two-Column Flex Layout */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">

          {/* Main Content Area (Left) */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">

            {/* AI Personalized Recommendation Card */}
            {loadingRec ? (
              <div data-tour="ai-recommendation" className="bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 rounded-2xl p-7 border border-indigo-500/20 relative overflow-hidden flex flex-col justify-between min-h-[264px]">
                <div className="relative z-10 flex justify-between items-start mb-4 flex-wrap gap-3">
                  <div className="flex gap-2.5">
                    <div className="h-7 bg-white/10 rounded-full w-40 animate-pulse"></div>
                    <div className="h-7 bg-white/10 rounded-full w-32 animate-pulse"></div>
                  </div>
                  <div className="h-4 bg-white/5 rounded w-24 animate-pulse mt-1.5"></div>
                </div>

                <div className="relative z-10 mb-6 mt-2">
                  <div className="h-8 bg-white/10 rounded w-3/5 mb-4 animate-pulse"></div>
                  <div className="h-4 bg-white/5 rounded w-full mb-2.5 animate-pulse"></div>
                  <div className="h-4 bg-white/5 rounded w-4/5 animate-pulse"></div>
                </div>

                <div className="relative z-10 h-16 bg-white/5 border border-white/5 rounded-xl w-full mt-auto flex items-center justify-between p-4">
                  <div className="flex gap-4 w-full">
                    <div className="h-4 bg-white/5 rounded w-20 animate-pulse"></div>
                    <div className="h-4 bg-white/5 rounded w-28 animate-pulse"></div>
                    <div className="h-4 bg-white/5 rounded w-40 hidden sm:block animate-pulse"></div>
                  </div>
                  <div className="h-9 bg-white/10 rounded-lg w-32 shrink-0 animate-pulse"></div>
                </div>
              </div>
            ) : activeTasks.length > 0 && recommendation && recTask ? (
              <div data-tour="ai-recommendation" className="bg-gradient-to-br from-[#2a2266] to-[#16113a] rounded-[24px] p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between shadow-xl min-h-[280px] sm:min-h-[280px]">
                {/* Background decorative sweeps */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-indigo-400/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-purple-400/10 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

                <div className="relative z-10 flex-1">
                  {/* Top Badges */}
                  <div className="flex flex-col items-start gap-2.5 mb-5 sm:mb-5">
                    <span className="flex items-center gap-2 border border-blue-400/50 text-blue-300 font-bold text-[10px] tracking-widest uppercase px-3.5 py-1.5 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.1)] bg-blue-500/10">
                      <Zap size={13} fill="currentColor" /> AI RECOMMENDATION
                    </span>
                    <span className="flex items-center gap-2 border border-white/15 bg-white/10 text-slate-100 text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-full backdrop-blur-md">
                      {recommendation.current_energy_level || 'Active Working Window'}
                    </span>
                  </div>

                  {/* Main Content */}
                  <h2 className="text-white text-xl sm:text-2xl font-bold mb-2">{recTask.name !== 'Rest & Recharge' ? recTask.name : ''}</h2>
                  <p className="text-indigo-50/90 text-[14px] sm:text-[16px] leading-relaxed font-medium mb-5 sm:mb-6 max-w-2xl">
                    {recTask.reason_detail || "TaskPulse has identified the perfect task for your current context and energy levels. Dive in now to maximize your productivity."}
                  </p>
                </div>

                {/* Bottom Actions */}
                <div className="relative z-10 mt-auto">
                  <hr className="border-t border-white/20 mb-4 sm:mb-4" />
                  
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => updateTask(recTask.task_id, { status: 'completed' })}
                      className="flex-1 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium text-[13px] sm:text-sm py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors duration-200"
                    >
                      <CheckCircle2 size={16} className="text-emerald-400" /> Done
                    </button>
                    <button
                      onClick={() => navigate('/schedule', { state: { focusTaskId: recTask.task_id } })}
                      className="flex-[1.5] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[13px] sm:text-sm py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(79,70,229,0.4)] transition-all duration-200"
                    >
                      <span>Start Focus</span> <Play fill="currentColor" size={13} />
                    </button>
                  </div>

                  <p className="text-center text-indigo-200/50 text-[10px] sm:text-[11px] mt-4 sm:mt-4 font-medium tracking-wide">
                    Adaptive schedule dynamically tuned for maximum productivity
                  </p>
                </div>
              </div>
            ) : (
              <div data-tour="ai-recommendation" className="group bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl p-5 sm:p-7 shadow-[0_0_40px_rgba(99,102,241,0.15)] border border-indigo-500/30 relative overflow-hidden transition-all duration-500">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.25)]">
                        <Zap size={12} fill="currentColor" /> AI Engine Ready
                      </span>
                      <span className="bg-white/10 backdrop-blur-sm text-white/90 text-xs font-semibold px-3 py-1 rounded-full border border-white/10">
                        Welcome to TaskPulse
                      </span>
                    </div>
                    <span className="text-xs text-indigo-200/70 font-mono font-medium tracking-wider hidden sm:inline">Ready to Schedule</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">Create Your First Task to Unlock AI Recommendations</h3>
                  <p className="text-indigo-100/80 text-xs sm:text-sm mb-5 sm:mb-6 leading-relaxed max-w-3xl">
                    TaskPulse evaluates your real-time energy levels, deadlines, and chronotype to auto-recommend the single best task to work on right now.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/5 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/10">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5 font-bold text-white"><Clock size={14} className="text-amber-400" /> Quick Setup</span>
                      <span className="bg-indigo-500/40 text-indigo-100 px-2.5 py-1 rounded-md font-semibold whitespace-nowrap border border-indigo-400/20">AI Flexible or Fixed</span>
                    </div>
                    <button onClick={() => navigate('/tasks')} className="w-full sm:w-auto justify-center bg-white text-indigo-950 hover:bg-indigo-50 font-extrabold text-xs px-5 py-2.5 rounded-lg transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl">
                      + Create First Task <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Today's Schedule from Real Data */}
            <div data-tour="today-timeline" className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[var(--accent-base)]" />
                  <h3 className="font-bold text-[var(--text-main)]">Today's Timeline</h3>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{todayTasks.length} block{todayTasks.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex flex-col gap-4">
                {todayTasks.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-[var(--text-muted)]">No scheduled blocks today.</p>
                    <button onClick={() => navigate('/schedule')} className="text-xs text-[var(--accent-base)] font-bold mt-2 hover:underline">
                      Run the auto-scheduler →
                    </button>
                  </div>
                ) : (
                  todayTasks.sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start)).map((task, i) => {
                    const start = new Date(task.scheduled_start);
                    const end = new Date(task.scheduled_end);
                    const now = new Date(nowIST());
                    const isCompleted = task.status === 'completed';
                    const isPast = isCompleted || now > end;
                    const isActive = !isCompleted && now >= start && now <= end;

                    return (
                      <div key={task.id} className="relative flex items-stretch gap-4 group">
                        {/* Vertical Line Connector */}
                        {i < todayTasks.length - 1 && (
                          <div className={`absolute left-[11px] top-8 bottom-[-16px] w-[2px] rounded-full transition-colors ${
                            isCompleted ? 'bg-green-500/40' :
                            isPast ? 'bg-slate-200 dark:bg-slate-700/50' :
                            'bg-slate-200 dark:bg-slate-700/50 group-hover:bg-[var(--border-subtle)]'
                          }`} />
                        )}
                        
                        {/* Timeline Dot (Fixed Width Container for Alignment) */}
                        <div className="flex flex-col items-center pt-4 w-6 shrink-0 relative z-10">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center border-[2px] transition-all duration-300 bg-[var(--bg-panel)] ${
                            isActive ? 'border-[var(--accent-base)] shadow-[0_0_10px_var(--accent-base)] scale-110' :
                            isCompleted ? 'border-green-500 bg-green-500' :
                            isPast ? 'border-slate-300 dark:border-slate-600' :
                            'border-slate-300 dark:border-slate-600 group-hover:border-[var(--accent-base)]'
                          }`}>
                            {isActive && <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-base)] animate-pulse" />}
                            {isCompleted && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                        </div>

                        {/* Task Card (Consistent Sizing and Padding) */}
                        <div className={`flex-1 min-w-0 p-4 rounded-xl border transition-all duration-300 ${
                          isActive ? 'bg-[var(--accent-light)] border-[var(--accent-base)]/30 shadow-sm' :
                          isCompleted ? 'bg-[var(--bg-app)]/50 border-transparent opacity-60' :
                          'bg-[var(--bg-app)] border-[var(--border-subtle)] hover:shadow-sm'
                        }`}>
                          <p className={`text-[11px] font-black tracking-widest uppercase mb-1.5 transition-colors ${
                            isActive ? 'text-[var(--accent-base)]' :
                            isCompleted ? 'text-green-500' :
                            isPast ? 'text-[var(--text-muted)]' :
                            'text-[var(--text-muted)]'
                          }`}>
                            {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} – {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-bold truncate transition-colors ${
                              isPast ? 'text-[var(--text-muted)] line-through decoration-[var(--text-muted)]/40' :
                              'text-[var(--text-main)]'
                            }`}>
                              {task.name}
                            </p>
                            {isCompleted && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-md shadow-sm">
                                Completed
                              </span>
                            )}
                            {!isCompleted && task.fixed && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md shadow-sm">
                                Fixed
                              </span>
                            )}
                            {!isCompleted && !task.fixed && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] bg-[var(--bg-hover)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded-md">
                                {task.duration_minutes}m
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">● {tasks.length} total tasks</span>
                <Link to="/schedule" className="text-[var(--accent-base)] font-bold flex items-center gap-1 hover:underline">
                  Full schedule <ArrowRight size={14} />
                </Link>
              </div>
            </div>

          </div>

          {/* RIGHT SIDEBAR */}
          <div className="flex flex-col gap-5 lg:w-72 xl:w-80 lg:shrink-0">

            {/* Workspace Readiness */}
            <Section className="!mb-0">
              <div data-tour="workspace-readiness" className="p-6 flex items-center justify-between gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg viewBox="0 0 80 80" className="w-16 h-16">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
                    <circle cx="40" cy="40" r="34" fill="none" stroke={readinessScore === 100 ? '#22c55e' : '#6366f1'} strokeWidth="8"
                      strokeDasharray={213.6} strokeDashoffset={213.6 * (1 - readinessScore / 100)}
                      strokeLinecap="round" transform="rotate(-90 40 40)"
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[13px] font-black text-[var(--text-main)]">{readinessScore}%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Account Setup</p>
                  <h3 className="font-bold text-[16px] text-[var(--text-main)] leading-tight mb-1">Workspace Readiness</h3>
                  <p className={`text-[12px] font-semibold leading-snug ${readinessScore === 100 ? 'text-green-500' : 'text-indigo-500'}`}>
                    {readinessScore === 100 ? 'All systems configured! ✓' : `+${Math.round((100 - readinessScore) * 0.35)}% efficiency boost available`}
                  </p>
                </div>
              </div>
              {readinessScore < 100 && (
                <Row
                  isButton
                  title="Complete Profile & Preferences"
                  onClick={() => navigate('/profile-setup')}
                  className="bg-[var(--bg-app)] hover:bg-[var(--bg-hover)] text-[14px] font-semibold text-[var(--text-main)] border-t border-[var(--border-subtle)]"
                />
              )}
            </Section>

            {/* Stats Row - Real Data */}
            <Section className="!mb-0">
              <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)]">
                <div className="p-5 text-center">
                  <div className="flex justify-center mb-1.5">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  </div>
                  <p className="text-3xl font-black text-[var(--text-main)] tracking-tight">{completedTasks.length}</p>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Tasks</p>
                </div>
                <div className="p-5 text-center">
                  <div className="flex justify-center mb-1.5">
                    <BarChart3 size={18} className="text-indigo-500" />
                  </div>
                  <p className="text-3xl font-black text-[var(--text-main)] tracking-tight">{(totalFocusMinutes / 60).toFixed(1)}<span className="text-xl text-[var(--text-muted)]">h</span></p>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Focus Time</p>
                </div>
              </div>
            </Section>

            {/* Top Priority Action Items */}
            <div data-tour="priority-inbox">
              <Section
                className="!mb-0"
                title={<div className="flex items-center gap-2"><Zap size={16} className="text-amber-500" /> Priority Inbox</div>}
                footer={topPriorityTasks.length > 0 ? `TOP ${topPriorityTasks.length} URGENT` : undefined}
              >
                {topPriorityTasks.length === 0 ? (
                  <div className="p-8 flex flex-col items-center justify-center opacity-80">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                      <CheckCircle2 size={24} className="text-emerald-500" />
                    </div>
                    <p className="text-[15px] font-bold text-[var(--text-main)]">Inbox Zero!</p>
                    <p className="text-[13px] text-[var(--text-muted)] text-center mt-1 max-w-[200px] leading-relaxed">
                      All your flexible tasks are clear. You're completely caught up!
                    </p>
                  </div>
                ) : (
                  topPriorityTasks.map(task => (
                    <Row
                      key={task.id}
                      onClick={() => { }}
                      icon={Circle}
                      iconColor="bg-transparent text-[var(--text-muted)]"
                      title={task.name}
                      subtitle={
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${task.priority === 5 ? 'bg-red-500/10 text-red-500' : task.priority === 3 ? 'bg-amber-500/10 text-amber-500' : task.priority === 2 ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-500'}`}>
                            P{task.priority === 5 ? 'C' : task.priority}
                          </span>
                          {task.deadline && (
                            <span className="text-[10px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                              <Clock size={10} /> {new Date(task.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      }
                      right={
                        <button
                          onClick={(e) => { e.stopPropagation(); updateTask(task.id, { status: 'completed' }); }}
                          className="p-2 text-[var(--border-subtle)] hover:text-emerald-500 transition-colors"
                          title="Mark as complete"
                        >
                          <CheckCircle2 size={20} className="fill-current text-[var(--bg-panel)]" />
                        </button>
                      }
                    />
                  ))
                )}
              </Section>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
