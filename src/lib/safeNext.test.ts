// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect } from 'vitest'
import { safeNext } from './safeNext'

describe('safeNext', () => {
  it.each([
    ['/app?x=1#y', '/app?x=1#y'],
    ['/onboarding', '/onboarding'],
    [null, '/app'],
    ['', '/app'],
    ['https://evil.com', '/app'],
    ['//evil.com', '/app'],
    ['/\\evil.com', '/app'],
    ['javascript:alert(1)', '/app'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})
