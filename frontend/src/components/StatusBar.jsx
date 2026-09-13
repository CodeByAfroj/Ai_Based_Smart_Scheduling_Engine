export default function StatusBar({ status, solveTime, message, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)] self-start shrink-0 mb-2">
        <div className="w-2 h-2 rounded-full bg-[var(--accent-base)] animate-pulse" />
        <span className="text-xs font-medium text-[var(--text-main)]">Optimizing schedule...</span>
      </div>
    )
  }

  if (!status) return null

  const isSuccess = status === 'OPTIMAL' || status === 'FEASIBLE'

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border self-start shrink-0 mb-2 ${
      isSuccess
        ? 'border-[var(--accent-base)] bg-[var(--bg-panel)]'
        : 'border-red-500/40 bg-red-500/5'
    }`}>
      <div className={`w-2 h-2 rounded-full ${isSuccess ? 'bg-[var(--accent-base)]' : 'bg-red-500'}`} />
      {isSuccess ? (
        <>
          <span className="text-xs font-medium text-[var(--text-main)]">Schedule optimized</span>
          {solveTime != null && (
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              in {solveTime < 1 ? '<1' : solveTime.toFixed(1)}ms
            </span>
          )}
        </>
      ) : (
        <span className="text-xs font-medium text-red-300">Could not find a valid schedule</span>
      )}
    </div>
  )
}
