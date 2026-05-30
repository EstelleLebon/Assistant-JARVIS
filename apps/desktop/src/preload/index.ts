import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('jarvis', {
    clearConversation: () => ipcRenderer.send('conversation:clear'),
    setTTSVolume: (volume: number) => ipcRenderer.send('tts:set-volume', { volume }),
    replayMessage: (text: string) => ipcRenderer.send('tts:replay', { text }),
    onWake: (callback: () => void) => {
        ipcRenderer.on('assistant:wake', callback)
    },
    sendUserText: (text) => ipcRenderer.send('assistant:user_text', text),
    setMicMuted: (muted: boolean) => ipcRenderer.send('mic:set-muted', { muted }),
    notifyStartupComplete: () => ipcRenderer.send('app:startup-complete'),
    openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path),
    openUrl: (url: string) => ipcRenderer.invoke('shell:open-url', url),
    onNotification: (
        callback: (n: { id: string; title: string; message: string; timestamp: number }) => void
    ) => {
        const handler = (_: Electron.IpcRendererEvent, n: { id: string; title: string; message: string; timestamp: number }) => callback(n)
        ipcRenderer.on('assistant:notification', handler)
        return () => ipcRenderer.removeListener('assistant:notification', handler)
    }
})

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = api
}
