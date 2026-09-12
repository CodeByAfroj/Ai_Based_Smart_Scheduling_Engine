const priorityLabels = ['Low', 'Med', 'Normal', 'High', 'Critical']
const priorityStyles = [
  'text-blue-300 bg-blue-500/10 border-blue-500/20',
  'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  'text-amber-300 bg-amber-500/10 border-amber-500/20',
  'text-orange-300 bg-orange-500/10 border-orange-500/20',
  'text-rose-300 bg-rose-500/10 border-rose-500/20',
]

export default function TaskList({ tasks, onRemoveTask, scheduledTasks }) {
  if (tasks.length === 0) return null

  const scheduledMap = {}
  scheduledTasks.forEach(st => { scheduledMap[st.task_id] = st })

  return (
    <div className="glass rounded-2xl overflow-hidden animate-slide-up">
      <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-violet" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-sm font-semibold text-text-primary">Tasks</span>
        </div>
        <span className="text-[11px] font-mono text-text-muted bg-surface-primary/80 px-2.5 py-0.5 rounded-full border border-border-subtle">
          {tasks.length}
        </span>
      </div>

      <div className="max-h-[350px] overflow-y-auto divide-y divide-border-subtle/30">
        {tasks.map((task, index) => {
          const scheduled = scheduledMap[task.id]
          const pIdx = Math.min(Math.max((task.priority || 1) - 1, 0), 4)

          return (
            <div
              key={task.id}
              className="px-5 py-3.5 hover:bg-surface-hover/40 transition-all duration-200 group animate-fade-in"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {scheduled && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-dot-pulse" />
                    )}
                    <span className="text-[13px] font-semibold text-text-primary truncate">{task.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${priorityStyles[pIdx]} shrink-0`}>
                      {priorityLabels[pIdx]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                      </svg>
                      {task.duration_minutes}m
                    </span>
                    <span className="text-border-strong">·</span>
                    <span>{task.resource_id}</span>
                    {task.fixed && (
                      <>
                        <span className="text-border-strong">·</span>
                        <span className="text-accent-amber/80">🔒 Fixed</span>
                      </>
                    )}
                  </div>
                  {scheduled && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400/80">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Scheduled: {new Date(scheduled.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} → {new Date(scheduled.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onRemoveTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-all duration-200 cursor-pointer mt-0.5"
                  title="Remove task"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
