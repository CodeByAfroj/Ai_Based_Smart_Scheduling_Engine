export default function ScheduleControls({ workingHours, onChangeWorkingHours, onSchedule, onReschedule, isLoading, hasSchedule, taskCount }) {
  const canSchedule = taskCount > 0 && !isLoading

  return (
    <div className="glass rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '160ms' }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-emerald" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-semibold text-text-primary">Controls</span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Working Hours */}
        <div>
          <label className="block text-[11px] font-semibold text-text-muted mb-3 uppercase tracking-widest">Working Window</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="relative">
                <select
                  value={workingHours.start_hour}
                  onChange={e => onChangeWorkingHours({ ...workingHours, start_hour: parseInt(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl glass-input text-text-primary text-sm appearance-none cursor-pointer transition-all duration-300"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                  ))}
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <svg className="w-4 h-4 text-text-muted/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>

            <div className="flex-1">
              <div className="relative">
                <select
                  value={workingHours.end_hour}
                  onChange={e => onChangeWorkingHours({ ...workingHours, end_hour: parseInt(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl glass-input text-text-primary text-sm appearance-none cursor-pointer transition-all duration-300"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map(i => (
                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                  ))}
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-text-muted/50">
            {workingHours.end_hour - workingHours.start_hour}h window
          </p>
        </div>

        <div className="border-t border-border-subtle/50" />

        {/* Action buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onSchedule}
            disabled={!canSchedule}
            className="w-full py-3.5 rounded-xl btn-primary text-white font-semibold text-sm relative overflow-hidden disabled:opacity-25 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none cursor-pointer"
          >
            {isLoading && <div className="absolute inset-0 animate-shimmer" />}
            <span className="relative flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Optimizing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Schedule
                </>
              )}
            </span>
          </button>

          {!canSchedule && !isLoading && (
            <p className="text-[11px] text-text-muted/50 text-center">
              Add at least one task to generate a schedule
            </p>
          )}

          {hasSchedule && (
            <button
              onClick={onReschedule}
              disabled={isLoading}
              className="w-full py-3 rounded-xl glass border border-border-default text-text-secondary font-medium text-sm hover:text-text-primary hover:border-accent-violet/30 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reschedule
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
