import { create } from 'zustand'

export interface AppNotification {
    id: string
    title: string
    message: string
    timestamp: number
}

interface NotificationStore {
    notifications: AppNotification[]
    addNotification: (n: AppNotification) => void
    dismissNotification: (id: string) => void
    clearAll: () => void
}

const useNotificationStore = create<NotificationStore>((set) => ({
    notifications: [],
    addNotification: (n) => set((s) => ({ notifications: [...s.notifications, n] })),
    dismissNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
    clearAll: () => set({ notifications: [] })
}))

export default useNotificationStore
