// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// UI-side mirror of the RLS rules in supabase/migrations/*_security.sql.
// The database is the source of truth; this only decides what to show.
export const ROLES = ['viewer', 'contributor', 'pm', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = {
  'task:create': 'contributor',
  'task:update-own': 'contributor',
  'task:manage': 'pm',
  'escalation:resolve': 'pm',
  'sprint:manage': 'pm',
  'scenario:run': 'pm',
  'policy:edit': 'admin',
  'integrations:edit': 'admin',
  'members:manage': 'admin',
} as const satisfies Record<string, Role>

export type Permission = keyof typeof PERMISSIONS

export const roleRank = (r: Role) => ROLES.indexOf(r)
export const can = (role: Role | null | undefined, p: Permission) =>
  !!role && roleRank(role) >= roleRank(PERMISSIONS[p])

export const ROLE_LABEL: Record<Role, string> = { viewer: 'Viewer', contributor: 'Contributor', pm: 'PM', admin: 'Admin' }
