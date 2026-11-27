// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
/**
 * Avatar fills keyed by the stored Tailwind class (team_members.color). Deep, on-brand hues that keep
 * white initials ≥ 6:1 in both themes. Single source; components must not redefine this map.
 */
const PALETTE: Record<string, string> = {
  'bg-violet-500': '#0b6e64', 'bg-blue-500': '#0e6577', 'bg-pink-500': '#9b2c4f', 'bg-emerald-500': '#2c6b3a',
  'bg-amber-500': '#8a4500', 'bg-cyan-500': '#0e6577', 'bg-rose-500': '#a8301c', 'bg-indigo-500': '#45505c',
  'bg-teal-500': '#0b6e64', 'bg-orange-500': '#7a5a00', 'bg-fuchsia-500': '#9b2c4f', 'bg-red-600': '#a8301c',
  'bg-lime-500': '#4a5800', 'bg-sky-500': '#0e6577', 'bg-purple-500': '#6b4a2f', 'bg-green-500': '#2c6b3a',
  'bg-yellow-500': '#7a5a00', 'bg-slate-500': '#45505c',
}

export const avatarColor = (cls: string | undefined) => (cls && PALETTE[cls]) || '#45505c'
