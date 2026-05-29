import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('stt', {
    sendWake: () => ipcRenderer.send('stt:wake'),
    sendPartial: (text: string) => ipcRenderer.send('stt:partial', text),
    sendFinal: (text: string) => ipcRenderer.send('stt:final', text),
    sendLog: (level: 'info' | 'warn' | 'error', msg: string) =>
        ipcRenderer.send('stt:log', { level, msg }),
    onSessionEnd: (cb: () => void) => ipcRenderer.on('stt:session-end', cb)
})
