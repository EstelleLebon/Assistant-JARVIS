interface ScreenshotData {
    path: string
    timestamp?: string
    base64?: string
}

export default function ScreenshotPanelContent({ data }: { data: unknown }) {
    const d = data as ScreenshotData

    const openFile = () => {
        window.jarvis.openPath(d.path)
    }

    return (
        <div
            style={{
                padding: '10px',
                paddingTop: '44px',
                color: '#e0e0e0',
                fontFamily: 'sans-serif'
            }}
        >
            {d.base64 ? (
                <img
                    src={d.base64}
                    alt="Screenshot"
                    style={{
                        width: '100%',
                        borderRadius: '8px',
                        display: 'block',
                        marginBottom: '8px'
                    }}
                />
            ) : (
                <div
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        height: '80px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '8px',
                        fontSize: '12px',
                        color: '#666'
                    }}
                >
                    Image non disponible
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {d.timestamp && (
                    <div style={{ fontSize: '11px', color: '#666' }}>
                        {new Date(d.timestamp).toLocaleTimeString('fr-FR')}
                    </div>
                )}
                <button
                    onClick={openFile}
                    style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        color: '#e0e0e0',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    Ouvrir
                </button>
            </div>
        </div>
    )
}
