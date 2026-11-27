'use client'

import { useActionState } from 'react'
import { sendMagicLink, signInWithPassword, signInWithProvider, type AuthState } from './actions'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '@/components/auth/AuthCard'
import { GithubIcon } from '@/components/ui/brand-icons'

const idle: AuthState = { status: 'idle' }

const PROVIDER_LABEL = { github: 'Continue with GitHub', google: 'Continue with Google' } as const

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" />
    </svg>
  )
}

export function LoginForm({ next, providers, passwordEnabled }: {
  next: string
  providers: Array<'github' | 'google'>
  passwordEnabled: boolean
}) {
  const [magic, sendLink, sending] = useActionState(sendMagicLink, idle)
  const [pw, signIn, signingIn] = useActionState(signInWithPassword, idle)

  return (
    <div className="space-y-6">
      {providers.length > 0 && (
        <div className="space-y-2">
          {providers.map((p) => (
            <form key={p} action={signInWithProvider}>
              <input type="hidden" name="provider" value={p} />
              <input type="hidden" name="next" value={next} />
              <button type="submit" className={secondaryButtonClass}>
                {p === 'github' ? <GithubIcon size={16} /> : <GoogleMark />}
                {PROVIDER_LABEL[p]}
              </button>
            </form>
          ))}
        </div>
      )}

      {providers.length > 0 && <Divider label="or" />}

      <form action={sendLink} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Work email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="you@company.com"
            className={inputClass} disabled={sending || magic.status === 'sent'} />
        </label>
        <button type="submit" className={primaryButtonClass} disabled={sending || magic.status === 'sent'}>
          {sending ? 'Sending…' : magic.status === 'sent' ? 'Link sent' : 'Email me a sign-in link'}
        </button>
        <Status state={magic} />
      </form>

      {passwordEnabled && (
        <details className="group rounded-lg border border-dashed border-border px-3 py-2">
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
            Demo accounts (development only)
          </summary>
          <form action={signIn} className="mt-3 space-y-2">
            <input type="hidden" name="next" value={next} />
            <input name="email" type="email" required defaultValue="pm@demo.sprintagent.dev" aria-label="Email" className={inputClass} />
            <input name="password" type="password" required defaultValue="password123" aria-label="Password" className={inputClass} />
            <button type="submit" className={secondaryButtonClass} disabled={signingIn}>
              {signingIn ? 'Signing in…' : 'Sign in with password'}
            </button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              admin@ · pm@ · dev@ · viewer@demo.sprintagent.dev — password123
            </p>
            <Status state={pw} />
          </form>
        </details>
      )}
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function Status({ state }: { state: AuthState }) {
  if (state.status === 'idle' || !state.message) return null
  return (
    <p role={state.status === 'error' ? 'alert' : 'status'}
      className={`text-xs ${state.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
      {state.message}
    </p>
  )
}
