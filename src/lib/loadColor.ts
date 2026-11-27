// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
export function loadColor(load: number): string {
  if (load > 85) return 'var(--crit)'
  if (load > 72) return 'var(--warn)'
  return 'var(--ok)'
}
