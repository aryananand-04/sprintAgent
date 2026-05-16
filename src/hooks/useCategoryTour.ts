import { create } from 'zustand'

export interface CategoryStep {
  title: string
  desc: string
  liveIn: string
  view?: string
  featureId?: string      // data-feature-id anchor
  tourStep?: number       // reuse existing data-tour-step anchor
  side?: 'top' | 'bottom' | 'left' | 'right'
}

interface CategoryTourState {
  active: boolean
  categoryLabel: string
  categoryColor: string
  steps: CategoryStep[]
  index: number
  start: (label: string, color: string, steps: CategoryStep[], nav: (v: string) => void) => void
  next:  (nav: (v: string) => void) => void
  prev:  (nav: (v: string) => void) => void
  end:   () => void
}

export const useCategoryTour = create<CategoryTourState>((set, get) => ({
  active: false,
  categoryLabel: '',
  categoryColor: '',
  steps: [],
  index: 0,

  start: (label, color, steps, nav) => {
    set({ active: true, categoryLabel: label, categoryColor: color, steps, index: 0 })
    if (steps[0]?.view) nav(steps[0].view)
  },

  next: (nav) => {
    const { index, steps } = get()
    const next = index + 1
    if (next >= steps.length) {
      set({ active: false, index: 0 })
    } else {
      const cur = steps[index]
      const nxt = steps[next]
      set({ index: next })
      if (nxt?.view && nxt.view !== cur?.view) nav(nxt.view)
    }
  },

  prev: (nav) => {
    const { index, steps } = get()
    if (index <= 0) return
    const prev = index - 1
    const cur = steps[index]
    const prv = steps[prev]
    set({ index: prev })
    if (prv?.view && prv.view !== cur?.view) nav(prv.view)
  },

  end: () => set({ active: false, index: 0, steps: [], categoryLabel: '' }),
}))
