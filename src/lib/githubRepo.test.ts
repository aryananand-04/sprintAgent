import { describe, it, expect } from 'vitest'
import { parseRepo } from './githubRepo'

describe('parseRepo', () => {
  it.each([
    ['vercel/next.js', { owner: 'vercel', repo: 'next.js' }],
    ['https://github.com/vercel/next.js', { owner: 'vercel', repo: 'next.js' }],
    ['github.com/vercel/next.js/issues?q=1', { owner: 'vercel', repo: 'next.js' }],
    ['git@github.com:vercel/next.js.git', { owner: 'vercel', repo: 'next.js' }],
    ['  facebook/react  ', { owner: 'facebook', repo: 'react' }],
  ])('%s', (input, expected) => expect(parseRepo(input)).toEqual(expected))

  it.each(['', 'nope', 'https://gitlab.com/a/b', '../../etc/passwd', 'a/..', '-bad/repo'])('rejects %s', (input) => {
    expect(parseRepo(input)).toBeNull()
  })
})
