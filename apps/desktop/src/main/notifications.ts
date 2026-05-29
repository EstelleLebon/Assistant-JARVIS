type EmitFn = (channel: string, payload?: any) => void
let emitFn: EmitFn = () => {}

export function initNotifications(emit: EmitFn): void {
    emitFn = emit
}

export function sendNotification(title: string, message: string): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    emitFn('assistant:notification', { id, title, message, timestamp: Date.now() })
}
