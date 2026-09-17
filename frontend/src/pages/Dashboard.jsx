import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import {
  Bell, CheckCircle2, Clock, Calendar, ArrowRight,
  Zap, BarChart3, ChevronRight, Play
} from 'lucide-react';
import { formatIST, formatDateIST, nowIST } from '../utils/time'

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
      let reason = "Standard Priority";
      if (t.priority === 5) reason = "Marked Critical";
      else if (t.priority === 3) reason = "Marked High Priority";
      else if (t.deadline) reason = "Closest Deadline";
      else if (index === 0) reason = "Next Actionable Item";
      return { ...t, reason };
    });

  const [recommendation, setRecommendation] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Fast-loading Cache System (5 minute TTL)
    // The cache key now dynamically depends on your exact active tasks. 
    // If you complete or add a task, the cache instantly invalidates itself!
    const activeTasksString = tasks.filter(t => t.status !== 'completed').map(t => t.id).sort().join(',');
    const CACHE_KEY = `taskpulse_ai_rec_cache_${activeTasksString}`;
    const CACHE_TTL_MS = 5 * 60 * 1000;
    
    try {
      const cachedString = sessionStorage.getItem(CACHE_KEY);
      if (cachedString) {
        const { data, timestamp } = JSON.parse(cachedString);
        if (Date.now() - timestamp < CACHE_TTL_MS) {
          setRecommendation(data);
          return; // Skip API call and use instant cache
        }
      }
    } catch (e) {
      console.warn("Cache read failed", e);
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
  }, [token, tasks]);

  const recTask = recommendation?.recommended_next_task;
  const dateStr = new Date(nowIST()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6" data-tour="dashboard-hero">
        
        {/* Profile Completion Banner (Full Width) */}
        {!notifDismissed && profileIncomplete && (
          <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 mb-6 flex flex-col lg:flex-row gap-5 shadow-sm">
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

        {/* Two-Column Flex Layout */}
        <div className="flex flex-col lg:flex-row gap-6">

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
            ) : activeTasks.length > 0 && recommendation && recTask && recTask.name !== 'Rest & Recharge' ? (
              <div data-tour="ai-recommendation" className="group bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl p-7 shadow-[0_0_40px_rgba(99,102,241,0.15)] border border-indigo-500/30 relative overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(99,102,241,0.3)] hover:border-indigo-400/50">
                
                {/* Background decorative elements */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-colors duration-500"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-colors duration-500"></div>
                
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
                  <Zap size={200} />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.25)]">
                        <Zap size={12} fill="currentColor" /> AI Recommendation
                      </span>
                      <span className="bg-white/10 backdrop-blur-sm text-white/90 text-xs font-semibold px-3 py-1 rounded-full border border-white/10">
                        {recommendation.current_energy_level}
                      </span>
                    </div>
                    <span className="text-xs text-indigo-200/70 font-mono font-medium tracking-wider">Score: {recTask.score} pts</span>
                  </div>

                  <h3 className="text-2xl font-black text-white mb-2 tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-indigo-200 transition-all duration-300">{recTask.name}</h3>
                  <p className="text-indigo-100/80 text-sm mb-6 leading-relaxed max-w-3xl">{recTask.reason_detail}</p>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-3 bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 group-hover:bg-white/10 transition-colors duration-300">
                    <div className="flex flex-wrap items-center gap-4 text-xs w-full sm:w-auto">
                      <span className="flex items-center gap-1.5 font-bold text-white"><Clock size={14} className="text-amber-400"/> {recTask.duration_minutes} mins</span>
                      <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block"></div>
                      <span className="bg-indigo-500/40 text-indigo-100 px-2.5 py-1 rounded-md font-semibold whitespace-nowrap border border-indigo-400/20">{recTask.reason_badge}</span>
                      <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block"></div>
                      <span className="text-indigo-200/90 whitespace-nowrap">Recommended: <strong className="text-white">{recTask.recommended_time_slot}</strong></span>
                    </div>
                    <button onClick={() => navigate('/schedule')} className="w-full sm:w-auto justify-center bg-white text-indigo-950 hover:bg-indigo-50 font-extrabold text-xs px-5 py-2.5 rounded-lg transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 shrink-0">
                      Start Task <Play size={12} fill="currentColor" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div data-tour="ai-recommendation" className="group bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl p-7 shadow-[0_0_40px_rgba(99,102,241,0.15)] border border-indigo-500/30 relative overflow-hidden transition-all duration-500">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.25)]">
                        <Zap size={12} fill="currentColor" /> AI Engine Ready
                      </span>
                      <span className="bg-white/10 backdrop-blur-sm text-white/90 text-xs font-semibold px-3 py-1 rounded-full border border-white/10">
                        Welcome to TaskPulse
                      </span>
                    </div>
                    <span className="text-xs text-indigo-200/70 font-mono font-medium tracking-wider">Ready to Schedule</span>
                  </div>

                  <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Create Your First Task to Unlock AI Recommendations</h3>
                  <p className="text-indigo-100/80 text-sm mb-6 leading-relaxed max-w-3xl">
                    TaskPulse evaluates your real-time energy levels, deadlines, and chronotype to auto-recommend the single best task to work on right now.
                  </p>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-3 bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                    <div className="flex flex-wrap items-center gap-4 text-xs w-full sm:w-auto">
                      <span className="flex items-center gap-1.5 font-bold text-white"><Clock size={14} className="text-amber-400"/> Quick Setup</span>
                      <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block"></div>
                      <span className="bg-indigo-500/40 text-indigo-100 px-2.5 py-1 rounded-md font-semibold whitespace-nowrap border border-indigo-400/20">AI Flexible or Fixed</span>
                    </div>
                    <button onClick={() => navigate('/tasks')} className="w-full sm:w-auto justify-center bg-white text-indigo-950 hover:bg-indigo-50 font-extrabold text-xs px-5 py-2.5 rounded-lg transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl shrink-0">
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
                      <div key={task.id} className="group flex items-start gap-4 p-3 hover:bg-[var(--bg-hover)] rounded-xl transition-all duration-300">
                        <div className="flex flex-col items-center pt-0.5">
                          {/* Timeline Dot */}
                          <div className={`w-3 h-3 rounded-full border-[2.5px] shrink-0 transition-all duration-300 ${
                            isActive ? 'bg-[var(--accent-base)] border-[var(--accent-base)] shadow-[0_0_10px_var(--accent-base)] scale-125' : 
                            isCompleted ? 'bg-green-500 border-green-500' :
                            isPast ? 'bg-slate-400 border-slate-400 dark:bg-slate-500 dark:border-slate-500' : 
                            'bg-[var(--bg-panel)] border-slate-300 dark:border-slate-600 group-hover:border-[var(--accent-base)]'
                          }`} />
                          
                          {/* Connecting Line */}
                          {i < todayTasks.length - 1 && (
                            <div className={`w-0.5 h-full min-h-[2.5rem] my-1 rounded-full transition-colors ${
                              isCompleted ? 'bg-green-500/40' : 
                              isPast ? 'bg-slate-400/40' :
                              'bg-slate-200 dark:bg-slate-700/50 group-hover:bg-[var(--border-subtle)]'
                            }`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-bold tracking-wide uppercase mb-1 transition-colors ${
                            isActive ? 'text-[var(--accent-base)]' : 
                            isCompleted ? 'text-green-500' :
                            isPast ? 'text-[var(--text-muted)]' : 
                            'text-[var(--text-muted)]'
                          }`}>
                            {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} – {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold truncate transition-colors ${
                              isPast ? 'text-[var(--text-muted)] line-through decoration-[var(--text-muted)]/40' : 
                              'text-[var(--text-main)] group-hover:text-[var(--accent-base)]'
                            }`}>
                              {task.name}
                            </p>
                            {isCompleted && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-sm shadow-sm flex items-center gap-1">
                                <CheckCircle2 size={10} /> Completed
                              </span>
                            )}
                            {!isCompleted && task.fixed && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-sm shadow-sm">
                                Fixed
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
          <div className="flex flex-col gap-6 lg:w-72 xl:w-80 lg:shrink-0">
            
            {/* Workspace Readiness */}
            <div data-tour="workspace-readiness" className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
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
                <button onClick={() => navigate('/profile-setup')} className="btn-primary w-full text-sm py-3 flex items-center justify-center gap-2 shadow-sm">
                  Complete Profile & Preferences <ChevronRight size={16} />
                </button>
              )}
            </div>

            {/* Stats Row - Real Data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-4 text-center shadow-sm">
                <div className="flex items-center justify-center gap-1 text-green-600 mb-2">
                  <CheckCircle2 size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Completed</span>
                </div>
                <p className="text-2xl font-extrabold text-[var(--text-main)]">{completedTasks.length}</p>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Tasks</p>
              </div>
              <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-4 text-center shadow-sm">
                <div className="flex items-center justify-center gap-1 text-[var(--accent-base)] mb-2">
                  <BarChart3 size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Focus Time</span>
                </div>
                <p className="text-2xl font-extrabold text-[var(--text-main)]">{(totalFocusMinutes / 60).toFixed(1)}h</p>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Logged</p>
              </div>
            </div>

            {/* Top Priority Action Items */}
            <div data-tour="priority-inbox" className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm flex flex-col flex-1 min-h-[300px]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-amber-500" />
                  <h3 className="font-bold text-[var(--text-main)] text-sm">Priority Inbox</h3>
                </div>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Top {topPriorityTasks.length} Urgent</span>
              </div>
              
              <div className="flex flex-col gap-3 flex-1">
                {topPriorityTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full flex-1 py-6 opacity-80">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                      <CheckCircle2 size={28} className="text-green-500" />
                    </div>
                    <p className="text-sm font-bold text-[var(--text-main)]">Inbox Zero!</p>
                    <p className="text-xs text-[var(--text-muted)] text-center mt-1.5 max-w-[200px] leading-relaxed">
                      All your flexible tasks are clear. You're completely caught up!
                    </p>
                  </div>
                ) : (
                  topPriorityTasks.map(task => (
                    <div key={task.id} className="group flex items-start gap-3 p-3 bg-[var(--bg-app)] hover:bg-[var(--bg-hover)] rounded-xl border border-[var(--border-subtle)] transition-colors">
                      {/* One-Tap Complete Checkbox */}
                      <button onClick={() => updateTask(task.id, { status: 'completed' })} className="mt-0.5 shrink-0 text-slate-300 dark:text-slate-600 hover:text-green-500 transition-colors" title="Mark as complete">
                        <CheckCircle2 size={18} fill="currentColor" className="text-[var(--bg-panel)]" />
                      </button>
                      
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[var(--text-main)] truncate group-hover:text-[var(--accent-base)] transition-colors">{task.name}</p>
                        <div className="flex items-center flex-wrap gap-2 mt-1.5">
                          <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${task.priority === 5 ? 'bg-red-500/10 text-red-500' : task.priority === 3 ? 'bg-amber-500/10 text-amber-500' : task.priority === 2 ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-500'}`}>
                            P{task.priority === 5 ? 'C' : task.priority}
                          </span>
                          {task.deadline && (
                            <span className="text-[10px] text-[var(--text-muted)] font-medium flex items-center gap-1">
                              <Clock size={10} /> Due {new Date(task.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-panel)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded-sm">
                            {task.reason}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
