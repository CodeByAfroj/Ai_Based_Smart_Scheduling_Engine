import { useState, useCallback, useEffect } from 'react'
import Header from './components/Header'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'
import FixedEventForm from './components/FixedEventForm'
import Timeline from './components/Timeline'
import ScheduleControls from './components/ScheduleControls'
import StatusBar from './components/StatusBar'

const API_BASE = 'http://localhost:8000'

function App() {
  const loadState = (key, defaultVal) => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  const [tasks, setTasks] = useState(() => loadState('scheduler_tasks', []))
  const [fixedEvents, setFixedEvents] = useState(() => loadState('scheduler_fixedEvents', []))
  const [workingHours, setWorkingHours] = useState(() => loadState('scheduler_workingHours', { start_hour: 8, end_hour: 22 }))
  const [scheduledTasks, setScheduledTasks] = useState(() => loadState('scheduler_scheduledTasks', []))

  useEffect(() => {
    localStorage.setItem('scheduler_tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('scheduler_fixedEvents', JSON.stringify(fixedEvents))
  }, [fixedEvents])

  useEffect(() => {
    localStorage.setItem('scheduler_workingHours', JSON.stringify(workingHours))
  }, [workingHours])

  useEffect(() => {
    localStorage.setItem('scheduler_scheduledTasks', JSON.stringify(scheduledTasks))
  }, [scheduledTasks])

  const [solverStatus, setSolverStatus] = useState(null)
  const [solveTime, setSolveTime] = useState(null)
  const [solverMessage, setSolverMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAddTask = useCallback((task) => {
    setTasks(prev => [...prev, task])
    setError(null) // clear error when adding new task
  }, [])

  const handleRemoveTask = useCallback((taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setScheduledTasks(prev => prev.filter(st => st.task_id !== taskId))
  }, [])

  const handleAddEvent = useCallback((event) => {
    setFixedEvents(prev => [...prev, event])
    setError(null)
  }, [])

  const handleRemoveEvent = useCallback((eventId) => {
    setFixedEvents(prev => prev.filter(e => e.id !== eventId))
  }, [])

  const buildRequest = () => {
    if (tasks.length === 0) {
      setError('Add at least one task before scheduling.')
      return null
    }

    // Use earliest task start as reference_time
    const allStarts = tasks.map(t => new Date(t.earliest_start).getTime())
    const referenceTime = new Date(Math.min(...allStarts)).toISOString()

    return {
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        duration_minutes: t.duration_minutes,
        earliest_start: t.earliest_start,
        deadline: t.deadline,
        priority: t.priority,
        fixed: t.fixed,
        preferred_start_after: t.preferred_start_after || null,
        preferred_start_before: t.preferred_start_before || null,
        resource_id: t.resource_id || 'default',
        predecessors: t.predecessors || [],
      })),
      fixed_events: fixedEvents.map(e => ({
        id: e.id,
        name: e.name,
        start: e.start,
        end: e.end,
      })),
      working_hours: workingHours,
      reference_time: referenceTime,
    }
  }

  const callApi = async (endpoint) => {
    const request = buildRequest()
    if (!request) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Server error (${response.status})`)
      }

      const data = await response.json()
      setSolverStatus(data.status)
      setSolveTime(data.solve_time_ms)
      setSolverMessage(data.message)
      setScheduledTasks(data.tasks || [])

      if (data.status !== 'OPTIMAL' && data.status !== 'FEASIBLE') {
        setError(null) // status bar handles the messaging
      }
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('Cannot reach the backend server. Make sure it\'s running on port 8000.')
      } else {
        setError(err.message)
      }
      setSolverStatus(null)
      setSolveTime(null)
      setSolverMessage(null)
      setScheduledTasks([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSchedule = () => callApi('/schedule')
  const handleReschedule = () => callApi('/reschedule')

  return (
    <div className="min-h-screen font-sans">
      <Header
        solverStatus={solverStatus}
        isLoading={isLoading}
        taskCount={tasks.length}
        eventCount={fixedEvents.length}
      />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error banner */}
        {error && (
          <div className="mb-5 px-4 py-3.5 rounded-xl bg-rose-500/8 border border-rose-500/15 text-rose-300 text-sm flex items-start gap-3 animate-slide-down shadow-lg shadow-rose-500/5">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="flex-1 leading-relaxed">{error}</span>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left sidebar */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
            <TaskForm onAddTask={handleAddTask} existingTaskIds={tasks.map(t => t.id)} />
            <FixedEventForm onAddEvent={handleAddEvent} />
            <ScheduleControls
              workingHours={workingHours}
              onChangeWorkingHours={setWorkingHours}
              onSchedule={handleSchedule}
              onReschedule={handleReschedule}
              isLoading={isLoading}
              hasSchedule={scheduledTasks.length > 0}
              taskCount={tasks.length}
            />
          </aside>

          {/* Right main */}
          <section className="lg:col-span-8 xl:col-span-9 space-y-4">
            <StatusBar status={solverStatus} solveTime={solveTime} message={solverMessage} />

            <Timeline
              scheduledTasks={scheduledTasks}
              fixedEvents={fixedEvents}
              tasks={tasks}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <TaskList tasks={tasks} onRemoveTask={handleRemoveTask} scheduledTasks={scheduledTasks} />

              {/* Fixed events list */}
              {fixedEvents.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden animate-slide-up">
                  <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent-amber" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-semibold text-text-primary">Fixed Events</span>
                    </div>
                    <span className="text-[11px] font-mono text-text-muted bg-surface-primary/80 px-2.5 py-0.5 rounded-full border border-border-subtle">
                      {fixedEvents.length}
                    </span>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto divide-y divide-border-subtle/30">
                    {fixedEvents.map((event, i) => {
                      const dur = Math.round((new Date(event.end) - new Date(event.start)) / 60000)
                      return (
                        <div
                          key={event.id}
                          className="px-5 py-3.5 hover:bg-surface-hover/40 transition-all duration-200 group animate-fade-in"
                          style={{ animationDelay: `${i * 40}ms` }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[13px] font-semibold text-text-primary">{event.name}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">Fixed</span>
                              </div>
                              <div className="text-[11px] text-text-muted flex items-center gap-2">
                                <span>{new Date(event.start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                <span className="text-border-strong">→</span>
                                <span>{new Date(event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                                <span className="text-border-strong">·</span>
                                <span>{dur}m</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveEvent(event.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-all duration-200 cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-border-subtle/30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <span className="text-[11px] text-text-muted/40">Adaptive Scheduling Engine v1.0 — Powered by Google OR-Tools CP-SAT</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-dot-pulse" />
            <span className="text-[11px] text-text-muted/40">Engine Online</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
