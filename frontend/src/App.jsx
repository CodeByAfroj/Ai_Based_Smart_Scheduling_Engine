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
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultVal
    } catch { return defaultVal }
  }

  const [tasks, setTasks] = useState(() => loadState('scheduler_tasks', []))
  const [fixedEvents, setFixedEvents] = useState(() => loadState('scheduler_fixedEvents', []))
  const [workingHours, setWorkingHours] = useState(() => loadState('scheduler_workingHours', { start_hour: 8, end_hour: 22 }))
  const [scheduledTasks, setScheduledTasks] = useState(() => loadState('scheduler_scheduledTasks', []))

  useEffect(() => { localStorage.setItem('scheduler_tasks', JSON.stringify(tasks)) }, [tasks])
  useEffect(() => { localStorage.setItem('scheduler_fixedEvents', JSON.stringify(fixedEvents)) }, [fixedEvents])
  useEffect(() => { localStorage.setItem('scheduler_workingHours', JSON.stringify(workingHours)) }, [workingHours])
  useEffect(() => { localStorage.setItem('scheduler_scheduledTasks', JSON.stringify(scheduledTasks)) }, [scheduledTasks])

  const [solverStatus, setSolverStatus] = useState(null)
  const [solveTime, setSolveTime] = useState(null)
  const [solverMessage, setSolverMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAddTask = useCallback((task) => {
    setTasks(prev => [...prev, task])
    setError(null)
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
    if (tasks.length === 0) { setError('Please add at least one task to generate a schedule.'); return null }
    const allStarts = tasks.map(t => new Date(t.earliest_start).getTime())
    const referenceTime = new Date(Math.min(...allStarts)).toISOString()
    return {
      tasks: tasks.map(t => ({
        id: t.id, name: t.name,
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
      fixed_events: fixedEvents.map(e => ({ id: e.id, name: e.name, start: e.start, end: e.end })),
      working_hours: workingHours,
      reference_time: referenceTime,
    }
  }

  const callApi = async (endpoint) => {
    const request = buildRequest()
    if (!request) return
    setIsLoading(true); setError(null)
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Server error: ${response.status}`)
      }
      const data = await response.json()
      setSolverStatus(data.status)
      setSolveTime(data.solve_time_ms)
      setSolverMessage(data.message)
      setScheduledTasks(data.tasks || [])
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('Cannot connect to the scheduling engine.')
      } else {
        setError(err.message)
      }
      setSolverStatus(null); setSolveTime(null); setSolverMessage(null); setScheduledTasks([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSchedule = () => callApi('/schedule')
  const handleReschedule = () => callApi('/reschedule')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-app)]">
      <Header />

      {error && (
        <div className="bg-red-500/10 text-red-400 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      <main className="flex-1 w-full p-4 md:p-5 flex gap-5 h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Left Sidebar: Controls & Input */}
        <aside className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto pr-1 pb-8">
          <ScheduleControls
            workingHours={workingHours}
            onChangeWorkingHours={setWorkingHours}
            onSchedule={handleSchedule}
            onReschedule={handleReschedule}
            isLoading={isLoading}
            hasSchedule={scheduledTasks.length > 0}
            taskCount={tasks.length}
          />
          
          <TaskForm onAddTask={handleAddTask} />
          <FixedEventForm onAddEvent={handleAddEvent} />
          
          <TaskList tasks={tasks} onRemoveTask={handleRemoveTask} scheduledTasks={scheduledTasks} />
        </aside>

        {/* Right Main Area: The Calendar */}
        <section className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <StatusBar status={solverStatus} solveTime={solveTime} message={solverMessage} isLoading={isLoading} />

          <div className="flex-1" style={{ minHeight: 0 }}>
             <Timeline
                scheduledTasks={scheduledTasks}
                fixedEvents={fixedEvents}
                tasks={tasks}
              />
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
