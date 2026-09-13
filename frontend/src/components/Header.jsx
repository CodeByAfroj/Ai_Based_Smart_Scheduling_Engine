export default function Header() {
  return (
    <header className="h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-base)] flex items-center justify-center text-white font-bold text-lg shadow-sm">
          S
        </div>
        <h1 className="font-semibold text-lg text-[var(--text-main)]">Scheduler</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-[var(--text-muted)]">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>
    </header>
  )
}
