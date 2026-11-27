'use client'

import { useActionState, useState } from 'react'
import { createWorkspace, type OnboardingState } from './actions'
import { inputClass, primaryButtonClass } from '@/components/auth/AuthCard'

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 48)

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createWorkspace, {})
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Team or company name</span>
        <input name="name" required maxLength={60} placeholder="Acme Payments" className={inputClass} value={name}
          onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Workspace URL</span>
        <div className="flex items-center rounded-lg border border-input bg-card focus-within:ring-2 focus-within:ring-ring/30">
          <span className="pl-3 text-sm text-muted-foreground">sprintagent.app/</span>
          <input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,47}" value={slug}
            onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }}
            className="w-full bg-transparent py-2 pr-3 text-sm text-foreground focus:outline-none" aria-label="Workspace URL" />
        </div>
      </label>
      {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
      <button type="submit" className={primaryButtonClass} disabled={pending}>
        {pending ? 'Creating…' : 'Create workspace'}
      </button>
    </form>
  )
}
