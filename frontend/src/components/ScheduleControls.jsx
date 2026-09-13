export default function ScheduleControls({ workingHours, onChangeWorkingHours, onSchedule, onReschedule, isLoading, hasSchedule, taskCount }) {
  const canSchedule = taskCount > 0 && !isLoading
  
  return (
    <div className="panel p-5">
      <h3 className="text-base font-semibold text-[var(--text-main)] mb-4">Planning Window</h3>
      
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1">
          <label className="input-label">Start Time</label>
          <select
            value={workingHours.start_hour}
            onChange={e => onChangeWorkingHours({ ...workingHours, start_hour: parseInt(e.target.value) })}
            className="input-field"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="input-label">End Time</label>
          <select
            value={workingHours.end_hour}
            onChange={e => onChangeWorkingHours({ ...workingHours, end_hour: parseInt(e.target.value) })}
            className="input-field"
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map(i => (
              <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onSchedule}
          disabled={!canSchedule}
          className="btn-primary w-full flex justify-center items-center gap-2"
        >
          {isLoading ? (
            <span>Optimizing...</span>
          ) : (
            <span>Generate Schedule</span>
          )}
        </button>

        {hasSchedule && (
          <button
            onClick={onReschedule}
            disabled={isLoading}
            className="btn-ghost w-full"
          >
            Reschedule
          </button>
        )}
      </div>
    </div>
  )
}
