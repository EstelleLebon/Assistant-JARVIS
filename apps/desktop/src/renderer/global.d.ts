// Déclaration globale pour window.jarvis (fusionne avec preload)
declare global {
    interface Window {
        jarvis: {
            clearConversation: () => void
            setTTSVolume: (volume: number) => void
            replayMessage: (text: string) => void
            onWake: (callback: () => void) => void
            sendUserText: (text: string) => void
        }
    }
}
export {}
