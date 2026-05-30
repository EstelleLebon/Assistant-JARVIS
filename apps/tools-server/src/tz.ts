/**
 * Returns the UTC offset in minutes for a given IANA timezone at a specific instant.
 * Handles DST transitions correctly (e.g. Europe/Paris is +60 in winter, +120 in summer).
 */
function utcOffsetMinutes(date: Date, tz: string): number {
    const fmt = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
    const tzPart = fmt.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? ''
    const m = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/)
    if (!m) return 0
    const sign = m[1] === '+' ? 1 : -1
    return sign * (parseInt(m[2]) * 60 + parseInt(m[3] ?? '0'))
}

/**
 * Converts a bare date string (YYYY-MM-DD) to a UTC Date representing
 * start-of-day (00:00:00) or end-of-day (23:59:59) in the given timezone.
 */
export function dateOnlyToUtc(dateStr: string, tz: string, boundary: 'start' | 'end'): Date {
    const time = boundary === 'start' ? '00:00:00' : '23:59:59'
    const naiveUtc = new Date(`${dateStr}T${time}Z`)
    const offsetMin = utcOffsetMinutes(naiveUtc, tz)
    return new Date(naiveUtc.getTime() - offsetMin * 60_000)
}
