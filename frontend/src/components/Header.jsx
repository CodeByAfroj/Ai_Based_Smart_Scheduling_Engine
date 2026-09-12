import { useState, useEffect } from 'react'

export default function Header({ solverStatus, isLoading, taskCount, eventCount }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const statusConfig = {
    OPTIMAL: { color: 'bg-emerald-400', label: 'Optimal', ring: 'ring-emerald-400/20' },
    FEASIBLE: { color: 'bg-amber-400', label: 'Feasible', ring: 'ring-amber-400/20' },
    INFEASIBLE: { color: 'bg-rose-400', label: 'Infeasible', ring: 'ring-rose-400/20' },
    MODEL_INVALID: { color: 'bg-rose-400', label: 'Invalid Model', ring: 'ring-rose-400/20' },
  }

  const statusInfo = statusConfig[solverStatus]

  return (
    <header className="glass-strong sticky top-0 z-50 border-b border-border-default">
      <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-violet via-accent-indigo to-accent-cyan flex items-center justify-center shadow-lg shadow-accent-violet/25">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {isLoading && <div className="absolute inset-0 rounded-xl animate-pulse-glow" />}
          </div>
          <div>
            <h1 className="text-[17px] font-bold tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-accent-violet via-accent-indigo to-accent-cyan drop-shadow-md">
              Adaptive Scheduler
            </h1>
            <p className="text-[11px] text-text-muted font-medium mt-0.5 tracking-wide">
              OR-Tools CP-SAT Optimization Engine
            </p>
          </div>
        </div>

        {/* Center stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <svg className="w-3.5 h-3.5 text-accent-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="font-medium text-text-secondary">{taskCount}</span> Tasks
          </div>
          <div className="w-px h-4 bg-border-default" />
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <svg className="w-3.5 h-3.5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium text-text-secondary">{eventCount}</span> Events
          </div>
        </div>

        {/* Right — status + clock */}
        <div className="flex items-center gap-4">
          {statusInfo && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs ring-2 ${statusInfo.ring}`}>
              <span className={`w-2 h-2 rounded-full ${statusInfo.color} ${solverStatus === 'OPTIMAL' ? 'animate-dot-pulse' : ''}`} />
              <span className="font-semibold text-text-secondary">{statusInfo.label}</span>
            </div>
          )}
          <div className="hidden sm:block text-[11px] text-text-muted font-mono tabular-nums tracking-wide">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>
    </header>
  )
}
