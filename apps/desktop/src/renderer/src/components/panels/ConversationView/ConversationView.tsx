import { useEffect, useRef, useState } from 'react'
import useSessionStore from '../../../store/sessionStore'
import ToolCallBlock from './ToolCallBlock'

interface ConversationViewProps {
    visible: boolean
}

function ConversationView({ visible }: ConversationViewProps) {
    const {
        messages,
        sessionText,
        partialTranscript,
        streamingMessage,
        errorMessage,
        llmQueued,
        clearMessages,
        clearError,
        appendSessionFinal,
        commitSession
    } = useSessionStore()
    const [input, setInput] = useState('')
    const [llmQueuedLate, setLlmQueuedLate] = useState(false)

    useEffect(() => {
        if (!llmQueued) {
            setLlmQueuedLate(false)
            return
        }
        const t = setTimeout(() => setLlmQueuedLate(true), 15_000)
        return () => clearTimeout(t)
    }, [llmQueued])
    const bottomRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const isAtBottomRef = useRef(true)

    // --- Contraste adaptatif pour l'input ---
    // Couleur de fond de l'input (modifiable ici)
    const inputBg = 'rgba(0,120,255,0.06)'
    // Fonction pour extraire la luminosité d'une couleur rgba()
    function getLuminance(r: number, g: number, b: number) {
        // https://www.w3.org/TR/AERT/#color-contrast
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255
    }
    function parseRGBA(rgba: string): [number, number, number, number] {
        // rgba(0,120,255,0.06)
        const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
        if (!m) return [0, 0, 0, 1]
        return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), m[4] ? parseFloat(m[4]) : 1]
    }
    const [r, g, b] = parseRGBA(inputBg)
    const luminance = getLuminance(r, g, b)
    // Si fond clair, texte foncé, sinon texte blanc
    const inputColor = luminance > 0.5 ? '#1a2330' : '#fff'

    // Auto-scroll vers le bas uniquement si on était déjà en bas
    useEffect(() => {
        if (isAtBottomRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, sessionText, partialTranscript, streamingMessage, errorMessage])

    const liveText = [sessionText, partialTranscript].filter(Boolean).join(' ')
    const hasContent = messages.length > 0 || !!liveText || streamingMessage !== null

    if (!visible) return null

    return (
        <div
            className="conversation-wrap"
            style={{
                flex: '1 1 0%',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                height: '100%',
                width: '100%',
                padding: 0,
                top: 4,
                paddingTop: '4px',
                paddingBottom: '8px',
                paddingLeft: '4px',
                paddingRight: '4px',
                boxSizing: 'border-box',
                position: 'relative'
            }}
        >
            <div
                ref={scrollRef}
                className="conversation"
                style={{
                    flex: '1 1 0%',
                    overflowY: 'auto',
                    minHeight: 0,
                    margin: 2,
                    padding: 0,
                    top: 0,
                    bottom: 0,
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                }}
                onScroll={(e) => {
                    const el = e.currentTarget
                    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
                }}
            >
                {/* Spacer pour pousser les messages vers le bas quand peu de contenu */}
                <div style={{ flex: 1 }} />
                {messages.map((msg) => {
                    if (msg.role === 'tool') {
                        return <ToolCallBlock key={msg.id} msg={msg} />
                    }
                    return (
                        <div
                            key={msg.id}
                            className={`message message--${msg.role}`}
                            style={{
                                width: '100%',
                                margin: 2,
                                padding: '6px 12px',
                                boxSizing: 'border-box',
                                wordBreak: 'break-word',
                                background:
                                    msg.role === 'assistant'
                                        ? 'rgba(0,120,255,0.04)'
                                        : 'transparent'
                            }}
                        >
                            {msg.text}
                            {msg.role === 'assistant' && (
                                <button
                                    className="message__replay"
                                    onClick={() => window.jarvis.replayMessage(msg.text)}
                                    title="Réécouter"
                                    style={{ marginLeft: 8 }}
                                >
                                    ▶
                                </button>
                            )}
                        </div>
                    )
                })}

                {liveText && (
                    <div
                        className="message message--user message--partial"
                        style={{
                            width: '100%',
                            margin: 2,
                            padding: '6px 12px',
                            boxSizing: 'border-box',
                            wordBreak: 'break-word'
                        }}
                    >
                        {liveText}
                    </div>
                )}

                {llmQueued && streamingMessage === null && (
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
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 10px',
                                background: 'rgba(255,255,255,0.04)',
                                border: `1px solid ${llmQueuedLate ? 'rgba(255,160,50,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 8,
                                color: 'rgba(255,255,255,0.55)',
                                fontSize: 12
                            }}
                        >
                            <span style={{ fontSize: 13, opacity: 0.6 }}>⏳</span>
                            <span
                                style={{
                                    fontWeight: 600,
                                    color: llmQueuedLate
                                        ? 'rgba(255,160,50,0.9)'
                                        : 'rgba(255,255,255,0.7)'
                                }}
                            >
                                {llmQueuedLate ? 'Ollama semble lent…' : "En attente d'Ollama…"}
                            </span>
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: 10,
                                    height: 10,
                                    border: '1.5px solid rgba(255,255,255,0.2)',
                                    borderTopColor: llmQueuedLate
                                        ? 'rgba(255,160,50,0.9)'
                                        : 'rgba(255,255,255,0.7)',
                                    borderRadius: '50%',
                                    animation: 'tool-spin 0.7s linear infinite',
                                    verticalAlign: 'middle'
                                }}
                            />
                        </div>
                    </div>
                )}

                {streamingMessage !== null && (
                    <div
                        className="message message--assistant message--streaming"
                        style={{
                            width: '100%',
                            margin: 2,
                            padding: '6px 12px',
                            boxSizing: 'border-box',
                            wordBreak: 'break-word'
                        }}
                    >
                        {streamingMessage}
                    </div>
                )}

                {errorMessage && (
                    <div
                        className="message message--error"
                        style={{
                            width: '100%',
                            margin: 2,
                            padding: '6px 12px',
                            boxSizing: 'border-box',
                            wordBreak: 'break-word',
                            color: 'rgba(255,80,80,0.9)',
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <span>⚠ {errorMessage}</span>
                        <button
                            onClick={clearError}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,80,80,0.6)',
                                cursor: 'pointer',
                                fontSize: 13,
                                padding: 0,
                                lineHeight: 1
                            }}
                            title="Fermer"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <form
                className="conversation__input-row"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    padding: '0', // pas de padding vertical, input touche le bas
                    margin: '2px',
                    background: 'transparent',
                    width: '100%',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                    flex: '0 0 auto'
                }}
                onSubmit={(e) => {
                    e.preventDefault()
                    const text = input.trim()
                    if (!text) return
                    window.jarvis.sendUserText(text)
                    appendSessionFinal(text)
                    commitSession()
                    setInput('')
                }}
            >
                <input
                    className="conversation__input"
                    type="text"
                    placeholder="Écrire un message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.currentTarget.form?.requestSubmit()
                        }
                    }}
                    style={{
                        flex: 1,
                        padding: 7,
                        margin: '0px 4px 0px 2px',
                        borderRadius: 8,
                        border: '1.5px solid rgba(0,120,255,0.18)',
                        fontSize: 15,
                        background: inputBg,
                        color: inputColor,
                        outline: 'none',
                        transition: 'border 0.15s',
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box'
                    }}
                    autoComplete="off"
                />
                <button
                    type="submit"
                    className="conversation__send"
                    style={{
                        padding: '5px 12px',
                        borderRadius: '999px',
                        margin: '0 0px 0 4px',
                        border: '1.5px solid rgba(0,120,255,0.25)',
                        background: 'transparent',
                        color: '#0078ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                        lineHeight: 1
                    }}
                    title="Envoyer"
                >
                    ↑
                </button>
                {hasContent && (
                    <button
                        className="conversation__clear"
                        onClick={(e) => {
                            e.preventDefault()
                            clearMessages()
                            window.jarvis.clearConversation()
                        }}
                        title="Effacer la conversation"
                        style={{
                            marginLeft: '0px',
                            marginRight: '2px',
                            background: 'none',
                            border: 'none',
                            color: '#888',
                            fontSize: 18,
                            cursor: 'pointer'
                        }}
                    >
                        ✕
                    </button>
                )}
            </form>
        </div>
    )
}

export default ConversationView
