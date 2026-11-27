// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect } from 'vitest'
import { can, ROLES, PERMISSIONS, type Role, type Permission } from './permissions'

// Must match the RLS matrix in supabase/tests/rls.test.sql.
const MATRIX: Record<Permission, Role[]> = {
  'task:create': ['contributor', 'pm', 'admin'],
  'task:update-own': ['contributor', 'pm', 'admin'],
  'task:manage': ['pm', 'admin'],
  'escalation:resolve': ['pm', 'admin'],
  'sprint:manage': ['pm', 'admin'],
  'scenario:run': ['pm', 'admin'],
  'policy:edit': ['admin'],
  'integrations:edit': ['admin'],
  'members:manage': ['admin'],
}

describe('can', () => {
  it.each(Object.keys(PERMISSIONS) as Permission[])('%s', (p) => {
    expect(ROLES.filter((r) => can(r, p))).toEqual(MATRIX[p])
  })
  it('denies when there is no role', () => {
    expect(can(null, 'task:create')).toBe(false)
  })
})
