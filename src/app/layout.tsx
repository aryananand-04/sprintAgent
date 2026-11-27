import type { Metadata, Viewport } from 'next'
import { Outfit, JetBrains_Mono, Instrument_Sans, Kalam } from 'next/font/google'
import '../index.css'

const sans = Outfit({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })
const display = Instrument_Sans({ subsets: ['latin'], variable: '--font-display-family', display: 'swap' })
const hand = Kalam({ subsets: ['latin'], weight: ['400'], variable: '--font-hand-family', display: 'swap' })

export const metadata: Metadata = {
  title: 'Sprint Agent — AI-Native Sprint Operator',
  description: 'An AI sprint operator that runs the operational middle of your sprint and escalates only when human judgment is cheaper.',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} ${hand.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
