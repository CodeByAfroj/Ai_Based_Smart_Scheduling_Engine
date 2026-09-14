import { useState } from 'react'
import { localInputToIST } from '../utils/time'

function getDefaultEventTimes() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(start.getHours() + 1)
  start.setMinutes(0, 0, 0)
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + 30)

  const fmt = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day}T${h}:${min}`
  }
  return { start: fmt(start), end: fmt(end) }
}

const defaultEvent = () => {
  const times = getDefaultEventTimes()
  return { name: '', start: times.start, end: times.end }
}

export default function FixedEventForm({ onAddEvent }) {
  const [event, setEvent] = useState(defaultEvent())
  const [isExpanded, setIsExpanded] = useState(false)

  const handleChange = (field, value) => setEvent(prev => ({ ...prev, [field]: value }))

const isValid = event.name && event.start && event.end &&
     new Date(localInputToIST(event.end)).getTime() > new Date(localInputToIST(event.start)).getTime();

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid) return

    const newEvent = {
      id: `EVT_${Date.now().toString().slice(-6)}`,
      name: event.name,
      start: localInputToIST(event.start),
      end: localInputToIST(event.end),
    }
    onAddEvent(newEvent)
    setEvent(defaultEvent())
    setIsExpanded(false)
  }

  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors text-left"
      >
        <span className="font-semibold text-[var(--text-main)]">Add Fixed Event</span>
        <span className="text-xl text-[var(--text-muted)] font-light leading-none">{isExpanded ? '−' : '+'}</span>
      </button>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="p-4 pt-0 flex flex-col gap-4 border-t border-[var(--border-subtle)] mt-1">
          <div className="mt-3">
            <label className="input-label">Event Name</label>
            <input
              type="text"
              value={event.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="e.g., Team Sync"
              className="input-field"
              required
            />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="input-label">Start Time</label>
              <input
                type="datetime-local"
                value={event.start}
                onChange={e => handleChange('start', e.target.value)}
                className="input-field [color-scheme:dark]"
                required
              />
            </div>
            <div>
              <label className="input-label">End Time</label>
              <input
                type="datetime-local"
                value={event.end}
                onChange={e => handleChange('end', e.target.value)}
                className="input-field [color-scheme:dark]"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={!isValid} className="btn-primary w-full mt-2">
            Save Event
          </button>
        </form>
      )}
    </div>
  )
}
