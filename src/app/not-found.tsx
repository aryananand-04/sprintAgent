// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import Link from 'next/link'
import { Logo, ButtonLink } from '@/components/marketing/primitives'
import { ClayQuestion } from '@/components/marketing/clay'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper px-4 py-6 font-display text-ink sm:px-10">
      <Link href="/" aria-label="Sprint Agent home" className="self-start"><Logo /></Link>
      <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center py-16 text-center">
        <ClayQuestion className="h-auto w-56 animate-float" />
        <h1 className="display-md mt-4">This page got escalated.</h1>
        <p className="mt-4 text-lg text-ink-2">We checked everywhere, including the backlog. Clarity score: 1/5. A human should probably look at the URL.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" arrow>Take me home</ButtonLink>
          <ButtonLink href="/try" variant="outline">Triage a repo instead</ButtonLink>
        </div>
      </div>
    </main>
  )
}
