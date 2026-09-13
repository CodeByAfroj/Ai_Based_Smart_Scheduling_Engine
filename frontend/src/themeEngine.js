export function computeTheme(tasks) {
  if (!tasks || tasks.length === 0) return 'calm'

  const priorities = tasks.map(t => t.priority || 3) // default to 3
  const avg = priorities.reduce((a, b) => a + b, 0) / priorities.length
  const maxPriority = Math.max(...priorities)

  // Determine theme based on priority
  // Themes: calm (light blue/gray), focus (indigo), energetic (orange/amber), urgent (rose)
  if (maxPriority >= 5 || avg > 4.2) return 'urgent'
  if (avg >= 3.5) return 'energetic'
  if (avg >= 2.5) return 'focus'
  return 'calm'
}
