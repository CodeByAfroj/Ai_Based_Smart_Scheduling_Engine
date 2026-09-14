import { useMemo, useRef, useEffect, useState } from 'react'
import { formatIST } from '../utils/time'

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' })
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function getDayName(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

function getStartOfWeek(d) {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d, n) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

const PIXELS_PER_MINUTE = 1.3
const VIEW_MODES = ['Day', '3-Day', 'Week']

export default function Timeline({ scheduledTasks, fixedEvents, tasks }) {
  const bodyRef = useRef(null)
  const [viewMode, setViewMode] = useState('Week')
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  // Scroll to current time on mount
  useEffect(() => {
    if (bodyRef.current) {
      const now = new Date()
      const nowMins = now.getHours() * 60 + now.getMinutes()
      const scrollTop = nowMins * PIXELS_PER_MINUTE - 120
      bodyRef.current.scrollTop = Math.max(0, scrollTop)
    }
  }, [scheduledTasks.length, viewMode])

  // Compute displayed days based on view mode
  const displayDays = useMemo(() => {
    const days = []
    if (viewMode === 'Day') {
      days.push(new Date(baseDate))
    } else if (viewMode === '3-Day') {
      for (let i = 0; i < 3; i++) days.push(addDays(baseDate, i))
    } else {
      const start = getStartOfWeek(baseDate)
      for (let i = 0; i < 7; i++) days.push(addDays(start, i))
    }
    return days
  }, [viewMode, baseDate])

  // Build all bars from scheduled tasks and fixed events
  const allBars = useMemo(() => {
    const taskMap = {}
    tasks.forEach(t => { taskMap[t.id] = t })
    const bars = []

    scheduledTasks.forEach(st => {
      const info = taskMap[st.task_id]
      const s = new Date(st.start)
      const e = new Date(st.end)
      bars.push({
        id: st.task_id,
        name: info?.name || st.task_id,
        start: s, end: e,
        duration: Math.round((e - s) / 60000),
        startMins: s.getHours() * 60 + s.getMinutes(),
        durationMins: (e.getHours() * 60 + e.getMinutes()) - (s.getHours() * 60 + s.getMinutes()),
        isFixed: false,
        priority: info?.priority || 3,
        date: new Date(s.getFullYear(), s.getMonth(), s.getDate()),
      })
    })

    fixedEvents.forEach(ev => {
      const s = new Date(ev.start)
      const e = new Date(ev.end)
      bars.push({
        id: ev.id,
        name: ev.name,
        start: s, end: e,
        duration: Math.round((e - s) / 60000),
        startMins: s.getHours() * 60 + s.getMinutes(),
        durationMins: (e.getHours() * 60 + e.getMinutes()) - (s.getHours() * 60 + s.getMinutes()),
        isFixed: true,
        priority: null,
        date: new Date(s.getFullYear(), s.getMonth(), s.getDate()),
      })
    })

    return bars
  }, [scheduledTasks, fixedEvents, tasks])

  // Bars for selected day detail panel
  const selectedDayBars = useMemo(() => {
    return allBars.filter(b => isSameDay(b.date, selectedDate)).sort((a, b) => a.startMins - b.startMins)
  }, [allBars, selectedDate])

  // Total load for selected day
  const selectedDayLoad = useMemo(() => {
    return selectedDayBars.reduce((sum, b) => sum + b.duration, 0)
  }, [selectedDayBars])

  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const nowTop = nowMins * PIXELS_PER_MINUTE
  const TOTAL_HEIGHT = 24 * 60 * PIXELS_PER_MINUTE
  const hours = Array.from({ length: 25 }, (_, i) => i)

  const navigateBack = () => {
    const offset = viewMode === 'Day' ? 1 : viewMode === '3-Day' ? 3 : 7
    setBaseDate(prev => addDays(prev, -offset))
  }
  const navigateForward = () => {
    const offset = viewMode === 'Day' ? 1 : viewMode === '3-Day' ? 3 : 7
    setBaseDate(prev => addDays(prev, offset))
  }
  const goToToday = () => {
    const today = new Date()
    setBaseDate(today)
    setSelectedDate(today)
  }

  const monthYearLabel = baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const hasData = allBars.length > 0

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-panel)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      
      {/* ═══ Toolbar ═══ */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Date Nav */}
          <button onClick={navigateBack} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-base font-bold text-[var(--text-main)] min-w-[180px] text-center">{monthYearLabel}</h2>
          <button onClick={navigateForward} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button onClick={goToToday} className="ml-2 px-3 py-1 text-xs font-semibold rounded-lg border border-[var(--accent-base)] text-[var(--accent-base)] hover:bg-[var(--accent-base)] hover:text-white transition-colors">
            Today
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex bg-[var(--bg-panel)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
          {VIEW_MODES.map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-[var(--accent-base)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ═══ Calendar Grid ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          
          {/* Day Headers */}
          <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-app)] shrink-0">
            <div className="w-16 shrink-0 border-r border-[var(--border-subtle)]" />
            {displayDays.map((day, idx) => {
              const isToday = isSameDay(day, now)
              const isSelected = isSameDay(day, selectedDate)
              const dayBars = allBars.filter(b => isSameDay(b.date, day))
              const totalHrs = (dayBars.reduce((s, b) => s + b.duration, 0) / 60).toFixed(1)
              return (
                <div
                  key={idx}
                  className={`flex-1 py-2 px-1 text-center border-r border-[var(--border-subtle)] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[var(--accent-base)]/10' : 'hover:bg-[var(--bg-hover)]'
                  }`}
                  onClick={() => setSelectedDate(new Date(day))}
                >
                  <div className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider">{getDayName(day)}</div>
                  <div className={`text-lg font-bold mt-0.5 ${isToday ? 'text-[var(--accent-base)]' : 'text-[var(--text-main)]'}`}>
                    {day.getDate()}
                  </div>
                  {dayBars.length > 0 && (
                    <div className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">
                      {totalHrs}h · {dayBars.length} tasks
                    </div>
                  )}
                  {isToday && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-base)] mx-auto mt-1" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Grid Body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto overflow-x-auto relative timeline-bg">
            <div className="flex" style={{ height: TOTAL_HEIGHT }}>
              
              {/* Time Axis */}
              <div className="w-16 shrink-0 relative border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] sticky left-0 z-30">
                {hours.map(hour => (
                  <div key={hour} className="absolute w-full text-right pr-3 text-[11px] font-medium text-[var(--text-muted)]" style={{ top: hour * 60 * PIXELS_PER_MINUTE - 7 }}>
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              {displayDays.map((day, dayIdx) => {
                const dayBars = allBars.filter(b => isSameDay(b.date, day))
                const isSelected = isSameDay(day, selectedDate)
                const isToday = isSameDay(day, now)

                // Layout overlapping bars into columns
                const sortedBars = [...dayBars].sort((a, b) => a.startMins - b.startMins)
                const cols = []
                sortedBars.forEach(bar => {
                  let placed = false
                  for (const col of cols) {
                    const last = col[col.length - 1]
                    if (last.startMins + last.durationMins <= bar.startMins) {
                      col.push(bar); placed = true; break
                    }
                  }
                  if (!placed) cols.push([bar])
                })
                const totalCols = cols.length
                cols.forEach((col, ci) => {
                  col.forEach(bar => { bar._colIdx = ci; bar._totalCols = totalCols })
                })

                return (
                  <div
                    key={dayIdx}
                    className="flex-1 relative border-r border-[var(--border-subtle)]"
                    style={{
                      backgroundColor: isSelected ? 'rgba(13,148,136,0.03)' : 'transparent',
                    }}
                  >
                    {/* Hour grid lines */}
                    {hours.map(hour => (
                      <div key={hour} className="absolute w-full border-t border-[var(--border-subtle)]" style={{ top: hour * 60 * PIXELS_PER_MINUTE }} />
                    ))}
                    {/* 30-min lines */}
                    {hours.slice(0, -1).map(hour => (
                      <div key={`h-${hour}`} className="absolute w-full border-t border-dashed border-[var(--border-subtle)] opacity-30" style={{ top: (hour * 60 + 30) * PIXELS_PER_MINUTE }} />
                    ))}

                    {/* Current time indicator (only on today) */}
                    {isToday && (
                      <div className="timeline-current-time-line" style={{ top: nowTop }}>
                        <div className="timeline-current-time-dot" />
                      </div>
                    )}

                    {/* Task blocks */}
                    {sortedBars.map(bar => {
                      const wPct = 100 / (bar._totalCols || 1)
                      const lPct = (bar._colIdx || 0) * wPct
                      return (
                        <div
                          key={bar.id}
                          className={`absolute timeline-event-card ${bar.isFixed ? 'fixed-event' : ''}`}
                          style={{
                            left: `calc(${lPct}% + 4px)`,
                            width: `calc(${wPct}% - 8px)`,
                            top: bar.startMins * PIXELS_PER_MINUTE + 1,
                            height: Math.max(bar.durationMins * PIXELS_PER_MINUTE - 2, 22),
                            zIndex: 5,
                          }}
                          onClick={() => setSelectedDate(new Date(day))}
                        >
                          <div className="px-2 py-1 h-full flex flex-col overflow-hidden">
{bar.durationMins * PIXELS_PER_MINUTE > 20 && (
  <span className="font-mono text-[9px] text-[var(--text-muted)]">
    {formatIST(bar.start.toISOString())} – {formatIST(bar.end.toISOString())}
  </span>
)}
                            <span className="text-[11px] font-bold text-[var(--text-main)] truncate leading-tight">
                              {bar.name}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ═══ Selected Day Detail Panel ═══ */}
        <div className="w-60 shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-app)] flex flex-col overflow-hidden">
          
          {/* Panel Header */}
          <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
            <div className="text-[10px] font-semibold text-[var(--accent-base)] tracking-wider uppercase mb-1">Selected Day</div>
            <h3 className="text-lg font-bold text-[var(--text-main)]">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {selectedDayBars.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[var(--text-muted)]">Day Load</span>
                  <span className="font-mono font-bold text-[var(--text-main)]">
                    {Math.floor(selectedDayLoad / 60)}h {selectedDayLoad % 60}m
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((selectedDayLoad / 480) * 100, 100)}%`,
                      backgroundColor: selectedDayLoad > 480 ? 'var(--priority-critical)' : selectedDayLoad > 360 ? 'var(--priority-high)' : 'var(--accent-base)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-1">
                  <span>{selectedDayBars.length} tasks scheduled</span>
                  <span>of 8h max</span>
                </div>
              </div>
            )}
          </div>

          {/* Tasks List */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {selectedDayBars.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <p className="text-sm text-[var(--text-muted)]">Nothing scheduled for this day.</p>
              </div>
            )}

            {selectedDayBars.map((bar, idx) => {
              const priorityLabel = bar.isFixed ? 'Fixed' : bar.priority >= 5 ? 'Critical' : bar.priority >= 4 ? 'High' : bar.priority >= 3 ? 'Normal' : bar.priority >= 2 ? 'Medium' : 'Low'
              const priorityColor = bar.isFixed ? 'var(--priority-high)' : bar.priority >= 5 ? 'var(--priority-critical)' : bar.priority >= 4 ? 'var(--priority-high)' : bar.priority >= 3 ? 'var(--accent-base)' : bar.priority >= 2 ? 'var(--priority-medium)' : 'var(--priority-low)'

              // Determine status based on current time
              const isNow = now >= bar.start && now <= bar.end && isSameDay(bar.date, now)
              const isPast = now > bar.end && isSameDay(bar.date, now)
              const isNext = !isNow && !isPast && idx === selectedDayBars.findIndex(b => !isPast && !(now >= b.start && now <= b.end))

              return (
                <div
                  key={bar.id}
                  className="rounded-lg border overflow-hidden transition-colors"
                  style={{
                    borderColor: isNow ? priorityColor : 'var(--border-subtle)',
                    borderLeftWidth: '4px',
                    borderLeftColor: priorityColor,
                    backgroundColor: isNow ? `${priorityColor}10` : 'var(--bg-panel)',
                  }}
                >
                  <div className="p-3">
                    {/* Time & Status */}
<div className="flex items-center gap-2 mb-1.5">
  <span className="font-mono text-xs font-bold text-[var(--text-main)]">
    {formatIST(bar.start.toISOString())} – {formatIST(bar.end.toISOString())}
  </span>
  <span className="font-mono text-[10px] text-[var(--text-muted)]">{bar.duration}m</span>
  {isNow && (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${priorityColor}25`, color: priorityColor }}>
      In Progress
    </span>
  )}
  {isNext && !isNow && (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-base)]/15 text-[var(--accent-base)]">
      Up Next
    </span>
  )}
  {isPast && (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)]">
      Done
    </span>
  )}
</div>

                    {/* Name */}
                    <h4 className="text-sm font-bold text-[var(--text-main)] leading-tight mb-1.5">{bar.name}</h4>

                    {/* Priority chip */}
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${priorityColor}18`, color: priorityColor, border: `1px solid ${priorityColor}40` }}
                      >
                        {priorityLabel}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
