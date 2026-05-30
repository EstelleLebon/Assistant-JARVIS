import { create } from 'zustand'

export interface ToolPanel {
    id: number
    toolName: string
    type: string
    data: unknown
    visible: boolean
}

interface ToolPanelStore {
    toolPanels: ToolPanel[]
    addToolPanel: (id: number, toolName: string, type: string, data: unknown) => void
    closePanelById: (id: number) => void
    showPanelById: (id: number) => void
    destroyPanelById: (id: number) => void
}

const useToolPanelStore = create<ToolPanelStore>((set) => ({
    toolPanels: [],

    addToolPanel: (id, toolName, type, data) =>
        set((state) => ({
            toolPanels: [...state.toolPanels, { id, toolName, type, data, visible: true }]
        })),

    closePanelById: (id) =>
        set((state) => ({
            toolPanels: state.toolPanels.map((p) => (p.id === id ? { ...p, visible: false } : p))
        })),

    showPanelById: (id) =>
        set((state) => ({
            toolPanels: state.toolPanels.map((p) => (p.id === id ? { ...p, visible: true } : p))
        })),

    destroyPanelById: (id) =>
        set((state) => ({
            toolPanels: state.toolPanels.filter((p) => p.id !== id)
        }))
}))

export default useToolPanelStore
