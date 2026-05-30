interface CalendarEvent {
    title: string
    start: string
    end: string
    location?: string
}

interface CalendarData {
    events: CalendarEvent[]
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    } catch {
        return iso
    }
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        })
    } catch {
        return iso
    }
}

function isToday(iso: string): boolean {
    const d = new Date(iso)
    const now = new Date()
    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    )
}

function isSoon(iso: string): boolean {
    const diff = new Date(iso).getTime() - Date.now()
    return diff > 0 && diff < 2 * 60 * 60 * 1000
}

export default function CalendarPanelContent({ data }: { data: unknown }) {
    const d = data as CalendarData

    return (
        <div
            style={{
                padding: '12px',
                paddingTop: '44px',
                color: '#e0e0e0',
                fontFamily: 'sans-serif'
            }}
        >
            {d.events.length === 0 ? (
                <div style={{ color: '#666', fontSize: '13px' }}>Aucun événement.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {d.events.map((ev, i) => {
                        const soon = isSoon(ev.start)
                        const today = isToday(ev.start)
                        return (
                            <div
                                key={i}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${soon ? 'rgba(255,160,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: '8px',
                                    padding: '10px 12px'
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start'
                                    }}
                                >
                                    <div style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>
                                        {ev.title}
                                    </div>
                                    {soon && (
                                        <div
                                            style={{
                                                fontSize: '10px',
                                                color: '#ffa000',
                                                marginLeft: '8px'
                                            }}
                                        >
                                            bientôt
                                        </div>
                                    )}
                                </div>
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
                                    {today ? '' : `${formatDate(ev.start)} · `}
                                    {formatTime(ev.start)} – {formatTime(ev.end)}
                                </div>
                                {ev.location && (
                                    <div
                                        style={{
                                            fontSize: '11px',
                                            color: '#666',
                                            marginTop: '2px'
                                        }}
                                    >
                                        📍 {ev.location}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
