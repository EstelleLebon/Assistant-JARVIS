type IsBusyFn = () => boolean

let isBusy: IsBusyFn = () => false
let lastNotificationAt = 0
const COOLDOWN_MS = 90_000

export function configureAttentionEngine(check: IsBusyFn): void {
    isBusy = check
}

export function canNotify(): boolean {
    if (isBusy()) return false
    return Date.now() - lastNotificationAt >= COOLDOWN_MS
}

export function recordNotification(): void {
    lastNotificationAt = Date.now()
}
