/** Accepts "owner/repo", "github.com/owner/repo", full URLs (with .git, /issues, etc). */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const s = input.trim().replace(/^git@github\.com:/i, '').replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
  const m = s.match(/^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:[/?#].*)?$/)
  if (!m) return null
  const [, owner, repo] = m
  if (repo === '.' || repo === '..') return null
  return { owner, repo }
}
