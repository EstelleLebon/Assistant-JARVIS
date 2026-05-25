import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('jarvis', {
    sendAudioChunk: (chunk: Float32Array) => ipcRenderer.send('audio:chunk', Array.from(chunk)),
    onWake: (callback: () => void) => {
        ipcRenderer.on('assistant:wake', callback)
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
