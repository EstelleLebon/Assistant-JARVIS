interface MemoryResult {
    type: string
    content: string
    created_at?: string
}

interface MemoryData {
    query: string
    results: MemoryResult[]
}

const TYPE_LABELS: Record<string, string> = {
    declarative: 'Faits',
    behavioral: 'Comportements',
    episodic: 'Souvenirs',
    semantic: 'Sémantique'
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
    } catch {
        return iso
    }
}

export default function MemoryPanelContent({ data }: { data: unknown }) {
    const d = data as MemoryData

    const grouped = d.results.reduce<Record<string, MemoryResult[]>>((acc, r) => {
        const key = r.type ?? 'other'
        if (!acc[key]) acc[key] = []
        acc[key].push(r)
        return acc
    }, {})

    return (
        <div style={{ padding: '12px', paddingTop: '44px', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>
                Mémoire : <strong style={{ color: '#aaa' }}>{d.query}</strong>
            </div>
            {d.results.length === 0 ? (
                <div style={{ color: '#666', fontSize: '13px' }}>Aucun souvenir trouvé.</div>
            ) : (
                Object.entries(grouped).map(([type, items]) => (
                    <div key={type} style={{ marginBottom: '12px' }}>
                        <div
                            style={{
                                fontSize: '10px',
                                color: '#666',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                marginBottom: '6px'
                            }}
                        >
                            {TYPE_LABELS[type] ?? type}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {items.map((item, i) => (
                                <div
                                    key={i}
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        borderRadius: '7px',
                                        padding: '8px 10px'
                                    }}
                                >
                                    <div style={{ fontSize: '12px', lineHeight: 1.4 }}>{item.content}</div>
                                    {item.created_at && (
                                        <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                                            {formatDate(item.created_at)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}
