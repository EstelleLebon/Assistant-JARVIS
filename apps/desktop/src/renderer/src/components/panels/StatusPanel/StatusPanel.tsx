import { useEffect, useState } from 'react'
import GenericPanel from '../GenericPanel'
import {
    runtimeState,
    type RuntimeState,
    type ServiceName,
    type ServiceStatus
} from '../../../runtime/runtime-state'

const SERVICE_LABELS: Record<ServiceName, string> = {
    wakeword: 'Wake Word',
    'chrome-stt': 'Chrome STT',
    piper: 'Piper TTS',
    'tools-server': 'Tools Server',
    'system-tools-server': 'System Tools'
}

const STATUS_COLOR: Record<ServiceStatus, string> = {
    stopped: 'rgba(255,255,255,0.18)',
    starting: '#fb923c',
    running: '#4ade80',
    error: '#ef4444'
}

const STATUS_LABEL: Record<ServiceStatus, string> = {
    stopped: 'stopped',
    starting: 'starting…',
    running: 'running',
    error: 'error'
}

const PIPER_STATUS_LABEL: Partial<Record<ServiceStatus, string>> = {
    stopped: 'idle',
    running: 'speaking'
}

const SERVICES: ServiceName[] = [
    'wakeword',
    'chrome-stt',
    'piper',
    'tools-server',
    'system-tools-server'
]

function ServiceRow({ name, status }: { name: ServiceName; status: ServiceStatus }) {
    const statusLabel =
        name === 'piper'
            ? (PIPER_STATUS_LABEL[status] ?? STATUS_LABEL[status])
            : STATUS_LABEL[status]
    const [hovered, setHovered] = useState(false)
    const color = name === 'piper' && status === 'stopped' ? '#60a5fa' : STATUS_COLOR[status]

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: '4px 0',
                cursor: 'default',
                minHeight: 24
            }}
        >
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    boxShadow: status === 'running' ? `0 0 6px 1px ${color}` : 'none',
                    animation:
                        status === 'starting' ? 'status-pulse 1.2s ease-in-out infinite' : 'none'
                }}
            />
            <span
                style={{
                    position: 'absolute',
                    bottom: 30,
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    color: 'rgba(255,255,255,0.5)',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    opacity: hovered ? 1 : 0,
                    pointerEvents: 'none'
                }}
            >
                {SERVICE_LABELS[name]}
                <span style={{ color, marginLeft: 8 }}>{statusLabel}</span>
            </span>
        </div>
    )
}

interface StatusPanelProps {
    visible: boolean
    onClose: () => void
    onShow: () => void
}

export default function StatusPanel({ visible, onClose, onShow }: StatusPanelProps) {
    const [state, setState] = useState<RuntimeState>(runtimeState.getState())

    useEffect(() => {
        return runtimeState.subscribe(setState)
    }, [])

    return (
        <>
            <style>{`
                @keyframes status-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.25; }
                }
            `}</style>
            <GenericPanel
                panelId="status"
                title="Services"
                visible={visible}
                onClose={onClose}
                onShow={onShow}
                anchorIndex={42}
                width="auto"
                height="auto"
                hideButtonText="◉"
                style={{
                    minWidth: 24,
                    padding: '44px 20px 16px 20px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    overflow: 'visible'
                }}
                connectionOptions={{ numLines: 4 }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 25,
                        overflow: 'visible'
                    }}
                >
                    {SERVICES.map((name) => (
                        <ServiceRow key={name} name={name} status={state.serviceStatus[name]} />
                    ))}
                </div>
            </GenericPanel>
        </>
    )
}
