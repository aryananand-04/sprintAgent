import { create } from 'zustand'

export const TOUR_VIEW: Record<number, string> = {
  1: 'sprint',
  2: 'sprint',
  3: 'sprint',
  4: 'intake',
  5: 'triage',
  6: 'escalations',
}

export const TOTAL_STEPS = Object.keys(TOUR_VIEW).length

interface TourState {
  active: boolean
  step: number
  singleMode: boolean   // true = show just this step, no Next/Back
  start:    (onNavigate: (view: string) => void) => void
  showTip:  (step: number, onNavigate: (view: string) => void) => void
  next:     (onNavigate: (view: string) => void) => void
  prev:     (onNavigate: (view: string) => void) => void
  end:      () => void
}

export const useTour = create<TourState>((set, get) => ({
  active: false,
  step: 1,
  singleMode: false,

  start: (nav) => {
    set({ active: true, step: 1, singleMode: false })
    nav(TOUR_VIEW[1])
  },

  // Show a single tooltip for a specific step — no progression
  showTip: (step, nav) => {
    set({ active: true, step, singleMode: true })
    nav(TOUR_VIEW[step])
  },

  next: (nav) => {
    const { step, singleMode } = get()
    if (singleMode) { set({ active: false, step: 1, singleMode: false }); return }
    const next = step + 1
    if (next > TOTAL_STEPS) {
      set({ active: false, step: 1 })
    } else {
      set({ step: next })
      if (TOUR_VIEW[next] !== TOUR_VIEW[step]) nav(TOUR_VIEW[next])
    }
  },

  prev: (nav) => {
    const { step, singleMode } = get()
    if (singleMode) return
    if (step <= 1) return
    const prev = step - 1
    set({ step: prev })
    if (TOUR_VIEW[prev] !== TOUR_VIEW[step]) nav(TOUR_VIEW[prev])
  },

  end: () => set({ active: false, step: 1, singleMode: false }),
}))
