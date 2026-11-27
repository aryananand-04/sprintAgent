// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import Link from 'next/link'
import { Container, Logo } from './primitives'

const COLUMNS = [
  { title: 'Product', links: [['How it works', '/#how'], ['Decisions', '/#decisions'], ['Earned Autonomy', '/#autonomy'], ['Pricing', '/pricing']] },
  { title: 'Get started', links: [['Try it on a repo', '/try'], ['Start free', '/login'], ['Log in', '/login']] },
]

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line-soft">
      <Container className="grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-mute">
            The agent runs the operational middle of your sprint and hands the edges to people, with the reasons written down.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-semibold text-ink">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map(([label, href]) => (
                <li key={label}><Link href={href} className="text-sm text-mute hover:text-ink">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <Container className="flex flex-col gap-2 border-t border-line-soft py-6 text-xs text-mute sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Sprint Agent</p>
        <p>Made by people who have sat through too many standups.</p>
      </Container>
    </footer>
  )
}
