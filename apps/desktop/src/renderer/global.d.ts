// Déclaration globale pour window.jarvis (fusionne avec preload)
declare global {
    interface Window {
        jarvis: {
            clearConversation: () => void
            setTTSVolume: (volume: number) => void
            replayMessage: (text: string) => void
            onWake: (callback: () => void) => () => void
            sendUserText: (text: string) => void
            setMicMuted: (muted: boolean) => void
            notifyStartupComplete: () => void
            openPath: (path: string) => Promise<string>
            openUrl: (url: string) => Promise<void>
            onNotification: (
                callback: (n: {
                    id: string
                    title: string
                    message: string
                    timestamp: number
                }) => void
            ) => () => void
            onAudioLevel: (callback: (level: number) => void) => () => void
        }
    }
}
export {}
