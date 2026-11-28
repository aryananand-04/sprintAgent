// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('quotes what needs quoting and serialises objects', () => {
    expect(toCsv([{ a: 'x,y', b: 'say "hi"', c: { k: 1 }, d: null }], ['a', 'b', 'c', 'd']))
      .toBe('a,b,c,d\r\n"x,y","say ""hi""","{""k"":1}",\r\n')
  })
  it('defuses spreadsheet formulas', () => {
    expect(toCsv([{ a: '=HYPERLINK("x")', b: '-2+3', c: '@SUM(A1)' }], ['a', 'b', 'c'])).toBe(`a,b,c\r\n"'=HYPERLINK(""x"")",'-2+3,'@SUM(A1)\r\n`)
  })
})
