interface SearchResult {
    title: string
    url: string
    snippet?: string
}

interface SearchResultsData {
    query: string
    results: SearchResult[]
}

export default function SearchResultsPanelContent({ data }: { data: unknown }) {
    const d = data as SearchResultsData

    const openUrl = (url: string) => {
        window.jarvis.openUrl(url)
    }

    return (
        <div style={{ padding: '12px', paddingTop: '44px', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>
                Résultats pour : <strong style={{ color: '#aaa' }}>{d.query}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {d.results.map((r, i) => (
                    <button
                        key={i}
                        onClick={() => openUrl(r.url)}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            color: 'inherit'
                        }}
                    >
                        <div
                            style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#7eb8f7',
                                marginBottom: '3px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {r.title}
                        </div>
                        <div
                            style={{
                                fontSize: '10px',
                                color: '#666',
                                marginBottom: r.snippet ? '4px' : 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {r.url}
                        </div>
                        {r.snippet && (
                            <div
                                style={{
                                    fontSize: '12px',
                                    color: '#999',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}
                            >
                                {r.snippet}
                            </div>
                        )}
                    </button>
                ))}
                {d.results.length === 0 && (
                    <div style={{ color: '#666', fontSize: '13px' }}>Aucun résultat.</div>
                )}
            </div>
        </div>
    )
}
