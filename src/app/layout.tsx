import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Instrument_Sans, Kalam, Lilita_One, Rubik, Chivo_Mono, Familjen_Grotesk } from 'next/font/google'
import '../index.css'

const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })
// One family everywhere: Instrument Sans is both the UI face and the display face.
const sans = Instrument_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
// B+C art direction: Lilita One (brand display), Rubik (brand body), Chivo Mono (app flaps/data), Familjen Grotesk (app UI)
const toon = Lilita_One({ subsets: ['latin'], weight: ['400'], variable: '--font-toon', display: 'swap' })
const rubik = Rubik({ subsets: ['latin'], variable: '--font-rubik', display: 'swap' })
const flap = Chivo_Mono({ subsets: ['latin'], variable: '--font-flap', display: 'swap' })
const appUi = Familjen_Grotesk({ subsets: ['latin'], variable: '--font-app', display: 'swap' })
const hand = Kalam({ subsets: ['latin'], weight: ['400'], variable: '--font-hand-family', display: 'swap' })

export const metadata: Metadata = {
  title: 'Sprint Agent — AI-Native Sprint Operator',
  description: 'An AI sprint operator that runs the operational middle of your sprint and escalates only when human judgment is cheaper.',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${hand.variable} ${toon.variable} ${rubik.variable} ${flap.variable} ${appUi.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply saved or OS theme before first paint (no flash). Keep in sync with THEME_STORAGE_KEY. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('theme');if(t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
