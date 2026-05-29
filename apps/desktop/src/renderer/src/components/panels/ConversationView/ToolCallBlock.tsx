import { useState } from 'react'
import type { ToolMessage } from '../../../store/sessionStore'

const TOOL_ICON = '⚙'

function formatArgs(args: Record<string, unknown>): string {
    const entries = Object.entries(args)
    if (!entries.length) return ''
    return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('  ·  ')
}

export default function ToolCallBlock({ msg }: { msg: ToolMessage }) {
    const [expanded, setExpanded] = useState(false)
    const pending = msg.toolResult === undefined
    const hasArgs = Object.keys(msg.toolArgs).length > 0

    return (
        <div
            style={{
                width: '100%',
                boxSizing: 'border-box',
                margin: '2px 0',
                padding: '0 12px'
            }}
        >
            <div
                style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    maxWidth: '100%',
                    minWidth: 0
                }}
            >
                {/* Header row — always visible */}
                <button
                    onClick={() => setExpanded((v) => !v)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                        minWidth: 0
                    }}
                >
                    <span style={{ fontSize: 13, opacity: 0.6 }}>{TOOL_ICON}</span>
                    <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: 'rgba(255,255,255,0.85)' }}>
                        {msg.toolName}
                    </span>
                    {hasArgs && !expanded && (
                        <span style={{ opacity: 0.45, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formatArgs(msg.toolArgs)}
                        </span>
                    )}
                    <span style={{ marginLeft: 'auto', paddingLeft: 12, opacity: 0.4, fontSize: 10 }}>
                        {pending ? (
                            <Spinner />
                        ) : (
                            expanded ? '▲' : '▼'
                        )}
                    </span>
                </button>

                {/* Expanded detail */}
                {expanded && !pending && (
                    <div
                        style={{
                            borderTop: '1px solid rgba(255,255,255,0.07)',
                            padding: '8px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8
                        }}
                    >
                        {hasArgs && (
                            <div>
                                <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    Arguments
                                </div>
                                <pre style={{
                                    margin: 0,
                                    fontSize: 11,
                                    color: 'rgba(255,255,255,0.6)',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    fontFamily: 'monospace'
                                }}>
                                    {JSON.stringify(msg.toolArgs, null, 2)}
                                </pre>
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                Résultat
                            </div>
                            <pre style={{
                                margin: 0,
                                fontSize: 11,
                                color: 'rgba(255,255,255,0.55)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                fontFamily: 'monospace',
                                maxHeight: 200,
                                overflowY: 'auto'
                            }}>
                                {msg.toolResult}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function Spinner() {
    return (
        <span
            style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                border: '1.5px solid rgba(255,255,255,0.2)',
                borderTopColor: 'rgba(255,255,255,0.7)',
                borderRadius: '50%',
                animation: 'tool-spin 0.7s linear infinite',
                verticalAlign: 'middle'
            }}
        />
    )
}
