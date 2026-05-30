interface WeatherData {
    city: string
    temp: number
    feels_like?: number
    condition: string
    humidity?: number
    wind?: number
    icon?: string
}

export default function WeatherPanelContent({ data }: { data: unknown }) {
    const w = data as WeatherData

    return (
        <div style={{ padding: '16px', paddingTop: '44px', fontFamily: 'sans-serif', color: '#e0e0e0' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '48px', lineHeight: 1 }}>{w.icon ?? '🌡️'}</div>
                <div style={{ fontSize: '42px', fontWeight: 700, marginTop: '8px' }}>
                    {w.temp}°
                </div>
                <div style={{ fontSize: '14px', color: '#aaa', marginTop: '4px' }}>{w.condition}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{w.city}</div>
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '10px'
                }}
            >
                {w.feels_like !== undefined && (
                    <Stat label="Ressenti" value={`${w.feels_like}°`} />
                )}
                {w.humidity !== undefined && (
                    <Stat label="Humidité" value={`${w.humidity}%`} />
                )}
                {w.wind !== undefined && (
                    <Stat label="Vent" value={`${w.wind} km/h`} />
                )}
            </div>
        </div>
    )
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{value}</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{label}</div>
        </div>
    )
}
