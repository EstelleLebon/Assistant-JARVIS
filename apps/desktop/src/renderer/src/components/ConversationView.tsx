import { useEffect, useRef } from 'react'
import useSessionStore from '../store/sessionStore'

function ConversationView() {
    const { messages, partialTranscript, streamingMessage } = useSessionStore()
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, partialTranscript, streamingMessage])

    return (
        <div className="conversation">
            {messages.map((msg) => (
                <div key={msg.id} className={`message message--${msg.role}`}>
                    {msg.text}
                </div>
            ))}

            {partialTranscript && (
                <div className="message message--user message--partial">{partialTranscript}</div>
            )}

            {streamingMessage !== null && (
                <div className="message message--assistant message--streaming">{streamingMessage}</div>
            )}

            <div ref={bottomRef} />
        </div>
    )
}

export default ConversationView
