import { useState } from 'react'
import GenericPanel from './GenericPanel'

interface SettingsPanelProps {
    visible: boolean
    onClose: () => void
    onShow: () => void
}

export default function SettingsPanel({ visible, onClose, onShow }: SettingsPanelProps) {
    const [volume, setVolume] = useState(1)
    const [micMuted, setMicMuted] = useState(false)

    function handleVolume(e: React.ChangeEvent<HTMLInputElement>) {
        const v = parseFloat(e.target.value)
        setVolume(v)
        window.jarvis.setTTSVolume(v)
    }

    function handleMicToggle() {
        const next = !micMuted
        setMicMuted(next)
        window.jarvis.setMicMuted(next)
    }

    return (
        <GenericPanel
            panelId="settings"
            title="Réglages"
            visible={visible}
            onClose={onClose}
            onShow={onShow}
            anchorIndex={60}
            width={200}
            height="auto"
            hideButtonText="⚙"
            connectionOptions={{ numLines: 16, color: 'rgba(255,255,255,0.2)', thickness: 0.1 }}
        >
            <div
                style={{
                    padding: '32px 16px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ color: '#666', fontSize: 11 }}>
                        Volume — {Math.round(volume * 100)}%
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        onChange={handleVolume}
                        style={{ width: '100%', accentColor: '#4ca8e8' }}
                    />
                </div>

                <button
                    onClick={handleMicToggle}
                    style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: micMuted ? '#e84c4c' : '#4ca8e8',
                        background: 'transparent',
                        color: micMuted ? '#e84c4c' : '#4ca8e8',
                        fontSize: 12,
                        cursor: 'pointer'
                    }}
                >
                    {micMuted ? 'Micro off' : 'Micro on'}
                </button>
            </div>
        </GenericPanel>
    )
}
