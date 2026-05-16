import { create } from 'zustand'

interface CommandPaletteStore {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  toggle: () => void
}

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}))
