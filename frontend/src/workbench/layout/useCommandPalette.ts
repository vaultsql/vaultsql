import { create } from 'zustand'

type CommandPaletteMode = 'tables' | 'schema'

type CommandPaletteState = {
  open: boolean
  mode: CommandPaletteMode
  setOpen: (open: boolean) => void
  setMode: (mode: CommandPaletteMode) => void
  openSchemaSelector: () => void
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  mode: 'tables',
  setOpen: (open) => set({ open, mode: open ? 'tables' : 'tables' }),
  setMode: (mode) => set({ mode }),
  openSchemaSelector: () => set({ open: true, mode: 'schema' }),
}))
