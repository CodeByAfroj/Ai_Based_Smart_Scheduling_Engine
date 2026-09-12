import { useMemo, useState } from 'react'

const TASK_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', borderLeft: '#2563eb', text: '#1e3a8a' }, // Blue
  { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', borderLeft: '#059669', text: '#064e3b' }, // Emerald
  { bg: 'rgba(139, 92, 246, 0.1)', border: '#8b5cf6', borderLeft: '#6d28d9', text: '#4c1d95' }, // Violet
  { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', borderLeft: '#d97706', text: '#78350f' }, // Amber
]

const FIXED_COLOR = {
  bg: 'rgba(244, 63, 94, 0.05)',
  border: '#f43f5e',
  borderLeft: '#e11d48',
  text: '#881337',
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function Timeline({ scheduledTasks, fixedEvents, tasks }) {
  const [hoveredBar, setHoveredBar] = useState(null)

  const timelineData = useMemo(() => {
    if (!scheduledTasks.length && !fixedEvents.length) return null

    // Extract resources
    const taskMap = {}
    tasks.forEach(t => { taskMap[t.id] = t })
    
    const resourceSet = new Set()
    const allBars = []

    scheduledTasks.forEach((st, i) => {
      const info = taskMap[st.task_id]
      const resourceId = info?.resource_id || 'default'
      resourceSet.add(resourceId)

      const s = new Date(st.start)
      const e = new Date(st.end)
      const startMins = s.getHours() * 60 + s.getMinutes()
      const endMins = e.getHours() * 60 + e.getMinutes()

      allBars.push({
        id: st.task_id,
        name: info?.name || st.task_id,
        start: s,
        end: e,
        duration: Math.round((e - s) / 60000),
        resourceId,
        startMins,
        durationMins: endMins - startMins,
        color: TASK_COLORS[i % TASK_COLORS.length],
        isFixed: false
      })
    })

    fixedEvents.forEach(ev => {
      const resourceId = 'default'
      resourceSet.add(resourceId)
      
      const s = new Date(ev.start)
      const e = new Date(ev.end)
      const startMins = s.getHours() * 60 + s.getMinutes()
      const endMins = e.getHours() * 60 + e.getMinutes()

      allBars.push({
        id: ev.id,
        name: ev.name,
        start: s,
        end: e,
        duration: Math.round((e - s) / 60000),
        resourceId,
        startMins,
        durationMins: endMins - startMins,
        color: FIXED_COLOR,
        isFixed: true
      })
    })

    const resources = Array.from(resourceSet).sort()

    // Calculate overlaps for each resource
    resources.forEach(res => {
      const resBars = allBars.filter(b => b.resourceId === res).sort((a, b) => a.startMins - b.startMins)
      const columns = []
      
      resBars.forEach(bar => {
        let placed = false
        for (const col of columns) {
          const lastEvent = col[col.length - 1]
          if (lastEvent.startMins + lastEvent.durationMins <= bar.startMins) {
            col.push(bar)
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([bar])
        }
      })
      
      const totalCols = columns.length
      columns.forEach((col, colIdx) => {
        col.forEach(bar => {
          bar.colIdx = colIdx
          bar.totalCols = totalCols
        })
      })
    })

    // Create hour markers (0 to 24)
    const hours = []
    for (let i = 0; i <= 24; i++) {
      hours.push(i)
    }

    return { resources, allBars, hours }
  }, [scheduledTasks, fixedEvents, tasks])

  if (!timelineData) {
    return (
      <div className="glass rounded-xl overflow-hidden shadow-sm border border-border-default h-64 flex flex-col items-center justify-center text-center p-8">
        <svg className="w-12 h-12 text-border-strong mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-semibold text-text-primary mb-1">No Schedule Generated</h3>
        <p className="text-sm text-text-secondary max-w-sm">
          Add tasks on the left and click "Generate Schedule" to see the calendar view.
        </p>
      </div>
    )
  }

  const { resources, allBars, hours } = timelineData

  // 1 minute = 1 pixel for easy math, so 24 hours = 1440px
  const PIXELS_PER_MINUTE = 1.2
  const TOTAL_HEIGHT = 24 * 60 * PIXELS_PER_MINUTE

  return (
    <div className="glass rounded-xl shadow-sm border border-border-default overflow-hidden bg-white flex flex-col h-[700px]">
      
      {/* Calendar Header */}
      <div className="flex border-b border-border-default bg-surface-secondary sticky top-0 z-20">
        {/* Time axis header space */}
        <div className="w-16 shrink-0 border-r border-border-default" />
        {/* Resource columns */}
        <div className="flex-1 flex overflow-hidden">
          {resources.map((res, idx) => (
            <div key={res} className={`flex-1 min-w-[200px] text-center py-3 ${idx < resources.length - 1 ? 'border-r border-border-default' : ''}`}>
              <div className="font-semibold text-text-primary text-sm">{res}</div>
              <div className="text-[10px] text-text-muted mt-0.5">Time Zone UTC</div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Body */}
      <div className="flex-1 overflow-y-auto relative bg-white flex">
        {/* Time axis */}
        <div className="w-16 shrink-0 relative bg-white border-r border-border-default z-10" style={{ height: TOTAL_HEIGHT }}>
          {hours.map(hour => (
            <div key={hour} className="absolute right-2 -translate-y-1/2 text-[11px] text-text-muted font-medium" style={{ top: hour * 60 * PIXELS_PER_MINUTE }}>
              {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
            </div>
          ))}
        </div>

        {/* Grid and Events */}
        <div className="flex-1 relative" style={{ height: TOTAL_HEIGHT }}>
          {/* Horizontal lines */}
          {hours.map(hour => (
            <div key={hour} className="absolute w-full border-t border-border-subtle" style={{ top: hour * 60 * PIXELS_PER_MINUTE }} />
          ))}

          {/* Resource Columns */}
          <div className="absolute inset-0 flex">
            {resources.map((res, idx) => {
              const resBars = allBars.filter(b => b.resourceId === res)
              return (
                <div key={res} className={`flex-1 relative min-w-[200px] ${idx < resources.length - 1 ? 'border-r border-border-subtle' : ''}`}>
                  {resBars.map(bar => {
                    const widthPct = 100 / (bar.totalCols || 1);
                    const leftPct = (bar.colIdx || 0) * widthPct;
                    
                    return (
                    <div
                      key={bar.id}
                      className="absolute rounded overflow-hidden cursor-pointer shadow-sm transition-shadow hover:shadow-md group"
                      style={{
                        left: `calc(${leftPct}% + 4px)`,
                        width: `calc(${widthPct}% - 8px)`,
                        top: bar.startMins * PIXELS_PER_MINUTE,
                        height: Math.max(bar.durationMins * PIXELS_PER_MINUTE, 20),
                        backgroundColor: bar.color.bg,
                        border: `1px solid ${bar.color.border}`,
                        borderLeft: `4px solid ${bar.color.borderLeft}`,
                        color: bar.color.text,
                        zIndex: hoveredBar === bar.id ? 10 : 1
                      }}
                      onMouseEnter={() => setHoveredBar(bar.id)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <div className="px-2 py-1 flex flex-col h-full overflow-hidden">
                        <div className="font-semibold text-xs truncate flex items-center gap-1">
                          {bar.isFixed && (
                            <svg className="w-3 h-3 opacity-70 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {bar.name}
                        </div>
                        <div className="text-[10px] opacity-90 truncate mt-0.5">
                          {formatTime(bar.start)} - {formatTime(bar.end)}
                        </div>
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
    </div>
  )
}
