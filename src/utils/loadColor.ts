export function loadColor(load: number): string {
  if (load > 85) return 'var(--crit)'
  if (load > 72) return 'var(--warn)'
  return 'var(--ok)'
}
