'use client'

import { useEffect, useRef, useState } from 'react'
import { LogOut, Check, Plus } from 'lucide-react'
import { useSession } from './SessionProvider'
import { ROLE_LABEL } from '@/lib/permissions'
import { switchWorkspace } from '@/app/onboarding/actions'

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

export function UserMenu() {
  const { user, current, memberships } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[10px] font-semibold text-foreground">
        {user.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element -- avatar host varies by provider
          ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          : initialsOf(user.name)}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-border bg-popover p-1.5 text-sm shadow-lg">
          <div className="px-2.5 py-2">
            <p className="truncate font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspaces</p>
          {memberships.map((m) => (
            <form key={m.workspace.id} action={switchWorkspace}>
              <input type="hidden" name="workspaceId" value={m.workspace.id} />
              <button type="submit" role="menuitem"
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-muted">
                <span className="truncate text-foreground">{m.workspace.name}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {ROLE_LABEL[m.role]}
                  {m.workspace.id === current.workspace.id && <Check size={12} aria-label="current" />}
                </span>
              </button>
            </form>
          ))}
          <a href="/onboarding" role="menuitem" className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-muted-foreground hover:bg-muted">
            <Plus size={12} /> New workspace
          </a>
          <div className="my-1 h-px bg-border" />
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-foreground hover:bg-muted">
              <LogOut size={12} /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
