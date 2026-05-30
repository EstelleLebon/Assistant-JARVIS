interface Routine {
    name: string
    done: number
    total: number
}

interface RoutinesData {
    routines: Routine[]
}

export default function RoutinesPanelContent({ data }: { data: unknown }) {
    const d = data as RoutinesData
    const totalDone = d.routines.reduce((sum, r) => sum + r.done, 0)
    const totalAll = d.routines.reduce((sum, r) => sum + r.total, 0)
    const globalPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0

    return (
        <div style={{ padding: '14px', paddingTop: '44px', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
            <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>Progression globale</span>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{globalPct}%</span>
                </div>
                <ProgressBar pct={globalPct} color="#7eb8f7" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {d.routines.map((r, i) => {
                    const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0
                    const complete = r.done >= r.total
                    return (
                        <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span style={{ fontSize: '12px', color: complete ? '#4caf50' : '#ccc' }}>
                                    {complete ? '✓ ' : ''}{r.name}
                                </span>
                                <span style={{ fontSize: '11px', color: '#888' }}>
                                    {r.done}/{r.total}
                                </span>
                            </div>
                            <ProgressBar pct={pct} color={complete ? '#4caf50' : '#7eb8f7'} thin />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function ProgressBar({ pct, color, thin = false }: { pct: number; color: string; thin?: boolean }) {
    return (
        <div
            style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '999px',
                height: thin ? '4px' : '6px',
                overflow: 'hidden'
            }}
        >
            <div
                style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: color,
                    borderRadius: '999px',
                    transition: 'width 0.3s ease'
                }}
            />
        </div>
    )
}
