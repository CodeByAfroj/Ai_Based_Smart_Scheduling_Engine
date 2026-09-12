export default function StatusBar({ status, solveTime, message }) {
  if (!status) return null

  const configs = {
    OPTIMAL: {
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/8 border-emerald-500/15',
      glow: 'shadow-emerald-500/5',
      label: 'Optimal Solution Found',
      description: 'The scheduler found the best possible arrangement for all tasks.',
    },
    FEASIBLE: {
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/8 border-amber-500/15',
      glow: 'shadow-amber-500/5',
      label: 'Feasible Solution',
      description: 'A valid schedule was found, but it may not be fully optimized.',
    },
    INFEASIBLE: {
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />,
      color: 'text-rose-400',
      bg: 'bg-rose-500/8 border-rose-500/15',
      glow: 'shadow-rose-500/5',
      label: 'No Feasible Solution',
      description: 'The constraints are too tight — try widening task windows or reducing durations.',
    },
    MODEL_INVALID: {
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      color: 'text-rose-400',
      bg: 'bg-rose-500/8 border-rose-500/15',
      glow: 'shadow-rose-500/5',
      label: 'Invalid Model',
      description: 'Some task time windows are too narrow for their durations. Check that each task\'s deadline minus earliest start is ≥ its duration.',
    },
  }

  const config = configs[status] || configs.INFEASIBLE

  return (
    <div className={`glass rounded-2xl overflow-hidden animate-scale-in border ${config.bg} shadow-lg ${config.glow}`}>
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 shrink-0 ${config.color}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {config.icon}
            </svg>
          </div>
          <div className="min-w-0">
            <div className={`text-sm font-bold ${config.color}`}>{config.label}</div>
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{config.description}</p>
            {message && message !== config.description && (
              <p className="text-[11px] text-text-muted/60 mt-1 italic">{message}</p>
            )}
          </div>
        </div>

        {solveTime != null && (
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Solve Time</span>
            <span className="text-sm font-mono font-bold text-text-secondary tabular-nums">
              {solveTime < 1 ? '<1ms' : `${solveTime.toFixed(1)}ms`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
