import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import { MotionProvider } from '@/components/marketing/Reveal'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper font-display text-ink antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <MotionProvider>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
      </MotionProvider>
    </div>
  )
}
