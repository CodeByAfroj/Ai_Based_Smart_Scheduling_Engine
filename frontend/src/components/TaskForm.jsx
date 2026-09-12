import { useState } from 'react'

const priorityConfig = [
  { label: 'Low', color: 'from-blue-500/80 to-blue-600/80', active: 'ring-blue-400/30' },
  { label: 'Med', color: 'from-cyan-500/80 to-teal-600/80', active: 'ring-cyan-400/30' },
  { label: 'Norm', color: 'from-amber-500/80 to-yellow-600/80', active: 'ring-amber-400/30' },
  { label: 'High', color: 'from-orange-500/80 to-red-500/80', active: 'ring-orange-400/30' },
  { label: 'Crit', color: 'from-rose-500/80 to-pink-600/80', active: 'ring-rose-400/30' },
]

function getDefaultDatetimes() {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(start.getMinutes() + 30)
  start.setSeconds(0, 0)

  const deadline = new Date(start)
  deadline.setHours(deadline.getHours() + 8)

  const fmt = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day}T${h}:${min}`
  }

  return { earliest_start: fmt(start), deadline: fmt(deadline) }
}

const defaultTask = () => {
  const dates = getDefaultDatetimes()
  return {
    name: '',
    duration_minutes: 30,
    priority: 3,
    earliest_start: dates.earliest_start,
    deadline: dates.deadline,
    preferred_start_after: '',
    preferred_start_before: '',
    resource_id: 'default',
    predecessors: '',
    fixed: false,
  }
}

export default function TaskForm({ onAddTask, existingTaskIds }) {
  const [task, setTask] = useState(defaultTask())
  const [isExpanded, setIsExpanded] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [shake, setShake] = useState(false)

  const handleChange = (field, value) => {
    setTask(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!task.name || !task.earliest_start || !task.deadline) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    // Validate deadline > earliest_start
    const startTime = new Date(task.earliest_start).getTime()
    const deadlineTime = new Date(task.deadline).getTime()
    if (deadlineTime <= startTime) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    // Validate duration fits in window
    const windowMinutes = (deadlineTime - startTime) / 60000
    if (task.duration_minutes > windowMinutes) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    const newTask = {
      id: `task_${Date.now()}`,
      name: task.name,
      duration_minutes: parseInt(task.duration_minutes),
      earliest_start: new Date(task.earliest_start).toISOString(),
      deadline: new Date(task.deadline).toISOString(),
      priority: parseInt(task.priority),
      fixed: task.fixed,
      preferred_start_after: task.preferred_start_after ? new Date(task.preferred_start_after).toISOString() : null,
      preferred_start_before: task.preferred_start_before ? new Date(task.preferred_start_before).toISOString() : null,
      resource_id: task.resource_id || 'default',
      predecessors: task.predecessors ? task.predecessors.split(',').map(s => s.trim()).filter(Boolean) : [],
    }

    onAddTask(newTask)
    setTask(defaultTask())
  }

  const windowMinutes = (() => {
    if (!task.earliest_start || !task.deadline) return null
    const diff = (new Date(task.deadline).getTime() - new Date(task.earliest_start).getTime()) / 60000
    return diff > 0 ? diff : null
  })()

  const durationValid = windowMinutes ? task.duration_minutes <= windowMinutes : true

  return (
    <div className={`glass rounded-2xl overflow-hidden animate-slide-up ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
      style={shake ? { animation: 'shake 0.4s ease-in-out' } : {}}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-hover/50 transition-all duration-300 cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-violet to-accent-indigo flex items-center justify-center shadow-md shadow-accent-violet/20 transition-transform duration-300 group-hover:scale-105">
            <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-text-primary block leading-tight">Add New Task</span>
            <span className="text-[11px] text-text-muted">Define task constraints & priority</span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4 animate-fade-in">
          {/* Task Name */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Task Name</label>
            <input
              type="text"
              value={task.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="e.g. Design Review, Code Sprint..."
              className="w-full px-4 py-2.5 rounded-xl glass-input text-text-primary text-sm placeholder:text-text-muted/40 transition-all duration-300"
              required
            />
          </div>

          {/* Duration + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">
                Duration
                {windowMinutes && (
                  <span className={`ml-1 normal-case tracking-normal ${durationValid ? 'text-text-muted/50' : 'text-rose-400'}`}>
                    (max {Math.floor(windowMinutes)}m)
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={task.duration_minutes}
                  onChange={e => handleChange('duration_minutes', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl glass-input text-text-primary text-sm transition-all duration-300 ${!durationValid ? 'border-rose-500/50!' : ''}`}
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted/50">min</span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Priority</label>
              <div className="flex gap-1">
                {priorityConfig.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleChange('priority', i + 1)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                      task.priority === i + 1
                        ? `bg-gradient-to-b ${p.color} text-white shadow-lg ring-2 ${p.active}`
                        : 'glass-input text-text-muted hover:text-text-secondary hover:border-border-strong'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Time Window */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Earliest Start</label>
              <input
                type="datetime-local"
                value={task.earliest_start}
                onChange={e => handleChange('earliest_start', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl glass-input text-text-primary text-sm transition-all duration-300 [color-scheme:light]"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Deadline</label>
              <input
                type="datetime-local"
                value={task.deadline}
                onChange={e => handleChange('deadline', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl glass-input text-text-primary text-sm transition-all duration-300 [color-scheme:light]"
                required
              />
            </div>
          </div>

          {/* Window info */}
          {windowMinutes && (
            <div className={`text-[11px] px-3 py-1.5 rounded-lg ${durationValid ? 'bg-accent-emerald/5 text-accent-emerald/70 border border-accent-emerald/10' : 'bg-rose-500/5 text-rose-400/70 border border-rose-500/10'}`}>
              {durationValid
                ? `✓ ${Math.floor(windowMinutes / 60)}h ${Math.floor(windowMinutes % 60)}m available window — task needs ${task.duration_minutes}m`
                : `✗ Task duration (${task.duration_minutes}m) exceeds available window (${Math.floor(windowMinutes)}m)`
              }
            </div>
          )}

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-[11px] text-accent-violet/70 hover:text-accent-violet transition-colors cursor-pointer"
          >
            <svg className={`w-3 h-3 transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Prefer After</label>
                  <input
                    type="datetime-local"
                    value={task.preferred_start_after}
                    onChange={e => handleChange('preferred_start_after', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-text-primary text-sm transition-all duration-300 [color-scheme:light]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Prefer Before</label>
                  <input
                    type="datetime-local"
                    value={task.preferred_start_before}
                    onChange={e => handleChange('preferred_start_before', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl glass-input text-text-primary text-sm transition-all duration-300 [color-scheme:light]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Resource</label>
                  <input
                    type="text"
                    value={task.resource_id}
                    onChange={e => handleChange('resource_id', e.target.value)}
                    placeholder="default"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-text-primary text-sm placeholder:text-text-muted/40 transition-all duration-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Predecessors</label>
                  <input
                    type="text"
                    value={task.predecessors}
                    onChange={e => handleChange('predecessors', e.target.value)}
                    placeholder="id1, id2..."
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-text-primary text-sm placeholder:text-text-muted/40 transition-all duration-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!durationValid}
            className="w-full py-3 rounded-xl btn-primary text-white font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </span>
          </button>
        </form>
      )}
    </div>
  )
}
