import { useState } from 'react'

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
    fixed: false,
  }
}

const PRIORITY_LABELS = {
  1: { label: 'Low', color: 'var(--priority-low)' },
  2: { label: 'Medium', color: 'var(--priority-medium)' },
  3: { label: 'Normal', color: 'var(--accent-base)' },
  4: { label: 'High', color: 'var(--priority-high)' },
  5: { label: 'Critical', color: 'var(--priority-critical)' }
}

export default function TaskForm({ onAddTask }) {
  const [task, setTask] = useState(defaultTask())
  const [isExpanded, setIsExpanded] = useState(false)

  const handleChange = (field, value) => setTask(prev => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!task.name || !task.earliest_start || !task.deadline) return
    const startTime = new Date(task.earliest_start).getTime()
    const deadlineTime = new Date(task.deadline).getTime()
    if (deadlineTime <= startTime) return

    const newTask = {
      id: `T_${Date.now().toString().slice(-6)}`,
      name: task.name,
      duration_minutes: parseInt(task.duration_minutes),
      earliest_start: new Date(task.earliest_start).toISOString(),
      deadline: new Date(task.deadline).toISOString(),
      priority: parseInt(task.priority),
      fixed: false,
    }
    onAddTask(newTask)
    setTask(defaultTask())
    setIsExpanded(false)
  }

  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors text-left"
      >
        <span className="font-semibold text-[var(--text-main)]">Add Task</span>
        <span className="text-xl text-[var(--text-muted)] font-light leading-none">{isExpanded ? '−' : '+'}</span>
      </button>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="p-4 pt-0 flex flex-col gap-4 border-t border-[var(--border-subtle)] mt-1">
          <div className="mt-3">
            <label className="input-label">Task Name</label>
            <input
              type="text"
              value={task.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="e.g., Weekly Report"
              className="input-field"
              required
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="input-label">Duration (min)</label>
              <input
                type="number"
                min="1"
                value={task.duration_minutes}
                onChange={e => handleChange('duration_minutes', parseInt(e.target.value) || 1)}
                className="input-field"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="input-label mb-2">Priority</label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(p => (
                <div
                  key={p}
                  onClick={() => handleChange('priority', p)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors border"
                  style={{
                    backgroundColor: task.priority === p ? `${PRIORITY_LABELS[p].color}20` : 'transparent',
                    borderColor: task.priority === p ? PRIORITY_LABELS[p].color : 'var(--border-subtle)',
                    color: task.priority === p ? PRIORITY_LABELS[p].color : 'var(--text-muted)'
                  }}
                >
                  {PRIORITY_LABELS[p].label}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Window Start</label>
              <input
                type="datetime-local"
                value={task.earliest_start}
                onChange={e => handleChange('earliest_start', e.target.value)}
                className="input-field text-sm [color-scheme:dark]"
                required
              />
            </div>
            <div>
              <label className="input-label">Deadline</label>
              <input
                type="datetime-local"
                value={task.deadline}
                onChange={e => handleChange('deadline', e.target.value)}
                className="input-field text-sm [color-scheme:dark]"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full mt-2">
            Save Task
          </button>
        </form>
      )}
    </div>
  )
}
