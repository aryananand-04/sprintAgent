import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Container, Tag } from '@/components/marketing/primitives'
import { TryRepo } from './TryRepo'

export const metadata: Metadata = {
  title: 'Triage your backlog · Sprint Agent',
  description: 'Paste a public GitHub repo and see every open issue triaged as Act, Ask or Escalate, in your browser. No signup.',
}

export default function TryPage() {
  return (
    <Container className="max-w-4xl pb-10 pt-12 sm:pt-20">
      <Tag tone="agent">Try it</Tag>
      <h1 className="display-lg mt-6 text-ink">Point it at a real backlog. <span className="text-agent-accent">Yours, ideally.</span></h1>
      <p className="mt-5 max-w-2xl text-lg text-ink-2">Paste a public GitHub repo. Every open issue gets a decision, a score and a reason in about ten seconds. No signup, no OAuth dance.</p>
      <div className="mt-10">
        <Suspense fallback={null}><TryRepo /></Suspense>
      </div>
    </Container>
  )
}
