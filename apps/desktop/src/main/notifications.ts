import logger from './logger'

type EmitFn = (channel: string, payload?: any) => void
let emitFn: EmitFn = () => {}

export function initNotifications(emit: EmitFn): void {
    emitFn = emit
}

export function sendNotification(title: string, message: string): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    emitFn('assistant:notification', { id, title, message, timestamp: Date.now() })

    fetch('http://127.0.0.1:7824/tools/system/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message }),
        signal: AbortSignal.timeout(3000)
    }).catch((err) => {
        logger.warn('[notifications] Desktop notify failed: ' + String(err))
    })
}
