import { useState } from 'react'

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

  const handleChange = (field, value) => {
    setEvent(prev => ({ ...prev, [field]: value }))
  }

  const isValid = event.name && event.start && event.end &&
    new Date(event.end).getTime() > new Date(event.start).getTime()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid) return

    const newEvent = {
      id: `event_${Date.now()}`,
      name: event.name,
      start: new Date(event.start).toISOString(),
      end: new Date(event.end).toISOString(),
    }

    onAddEvent(newEvent)
    setEvent(defaultEvent())
  }

  const duration = (() => {
    if (!event.start || !event.end) return null
    const diff = (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
    return diff > 0 ? diff : null
  })()

  return (
    <div className="glass rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '80ms' }}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-hover/50 transition-all duration-300 cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-amber to-accent-rose flex items-center justify-center shadow-md shadow-accent-amber/20 transition-transform duration-300 group-hover:scale-105">
            <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-text-primary block leading-tight">Add Fixed Event</span>
            <span className="text-[11px] text-text-muted">Meetings, breaks, blocked time</span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4 animate-fade-in">
          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Event Name</label>
            <input
              type="text"
              value={event.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="e.g. Team Standup, Lunch Break..."
              className="w-full px-4 py-2.5 rounded-xl glass-input text-text-primary text-sm placeholder:text-text-muted/40 transition-all duration-300"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">Start</label>
              <input
                type="datetime-local"
                value={event.start}
                onChange={e => handleChange('start', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl glass-input text-text-primary text-sm transition-all duration-300 [color-scheme:light]"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-widest">End</label>
              <input
                type="datetime-local"
                value={event.end}
                onChange={e => handleChange('end', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl glass-input text-text-primary text-sm transition-all duration-300 [color-scheme:light]"
                required
              />
            </div>
          </div>

          {duration && (
            <div className="text-[11px] px-3 py-1.5 rounded-lg bg-accent-amber/5 text-accent-amber/70 border border-accent-amber/10">
              🔒 Blocks {Math.floor(duration / 60) > 0 ? `${Math.floor(duration / 60)}h ` : ''}{Math.floor(duration % 60)}m — scheduler will work around this
            </div>
          )}

          {event.start && event.end && !duration && (
            <div className="text-[11px] px-3 py-1.5 rounded-lg bg-rose-500/5 text-rose-400/70 border border-rose-500/10">
              ✗ End time must be after start time
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-amber to-accent-rose text-white font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:shadow-accent-amber/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            Add Fixed Event
          </button>
        </form>
      )}
    </div>
  )
}
