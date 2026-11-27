'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { ButtonLink, Logo } from './primitives'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#decisions', label: 'Decisions' },
  { href: '/#autonomy', label: 'Earned Autonomy' },
  { href: '/try', label: 'Try it' },
  { href: '/pricing', label: 'Pricing' },
]

export function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-50 px-2 pt-2 sm:px-4">
      <nav aria-label="Main" className={cn(
        'mx-auto flex h-14 max-w-[1320px] items-center gap-6 rounded-2xl bg-paper/90 px-3 backdrop-blur-md transition-shadow sm:px-4',
        scrolled ? 'shadow-soft ring-1 ring-line-soft' : '',
      )}>
        <Link href="/" aria-label="Sprint Agent home" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agent-accent">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink">{l.label}</Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink">Log in</Link>
          <ButtonLink href="/try" variant="secondary">Try on your repo</ButtonLink>
          <ButtonLink href="/login">Start free</ButtonLink>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-paper-2 md:hidden">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>
      {open && (
        <div id="mobile-nav" className="mx-auto mt-2 max-w-[1320px] rounded-2xl bg-paper p-3 shadow-lift ring-1 ring-line-soft md:hidden">
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-paper-2">{l.label}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ButtonLink href="/login" variant="outline">Log in</ButtonLink>
            <ButtonLink href="/login">Start free</ButtonLink>
          </div>
        </div>
      )}
    </header>
  )
}
