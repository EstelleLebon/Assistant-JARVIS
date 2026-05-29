import { BrowserWindow } from 'electron'
import { sendNotification } from './notifications'

const serviceStatuses: Record<string, string> = {
    wakeword: 'stopped',
    'chrome-stt': 'stopped',
    piper: 'stopped',
    'tools-server': 'stopped',
    'system-tools-server': 'stopped'
}

function sendToRenderer(channel: string, payload?: any) {
    BrowserWindow.getAllWindows()[0]?.webContents.send(channel, payload)
}

export function updateServiceStatus(service: string, status: string): void {
    const previous = serviceStatuses[service]
    serviceStatuses[service] = status
    sendToRenderer('service:status', { service, status })
    if (status === 'error' && previous !== 'error') {
        sendNotification('Service', `${service} a rencontré une erreur.`)
    }
}

export function flushServiceStatuses(): void {
    for (const [service, status] of Object.entries(serviceStatuses)) {
        sendToRenderer('service:status', { service, status })
    }
}
