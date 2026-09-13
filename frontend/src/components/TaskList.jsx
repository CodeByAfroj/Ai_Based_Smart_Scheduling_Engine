export default function TaskList({ tasks, onRemoveTask, scheduledTasks }) {
  if (tasks.length === 0) return null

  const scheduledMap = {}
  scheduledTasks.forEach(st => { scheduledMap[st.task_id] = st })

  const sortedTasks = [...tasks].sort((a, b) => (b.priority || 1) - (a.priority || 1))

  return (
    <div className="panel overflow-hidden flex flex-col max-h-64">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
        <span className="font-semibold text-sm text-[var(--text-main)]">Your Tasks</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedTasks.map((task) => {
          const scheduled = scheduledMap[task.id]
          return (
            <div key={task.id} className="p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] group flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--text-main)]">{task.name}</span>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="font-mono">{task.duration_minutes}m</span>
                  <span>•</span>
                  {scheduled ? (
                    <span className="text-[var(--accent-base)] font-medium">Scheduled</span>
                  ) : (
                    <span>Unscheduled</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onRemoveTask(task.id)}
                className="text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                title="Delete Task"
              >
                Delete
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
