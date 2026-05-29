import React, { useState } from 'react'
import GenericPanel from '../GenericPanel'
import ConversationView from './ConversationView'

const ConversationPanel: React.FC = () => {
    const [visible, setVisible] = useState(true)
    return (
        <GenericPanel
            panelId="conversation-panel"
            title="Conversation"
            visible={visible}
            onClose={() => setVisible(false)}
            onShow={() => setVisible(true)}
            anchorIndex={4242} // ancrage sur la particule 1 de l'orbe
            width={480}
            height="75%"
            connectionOptions={{ color: 'rgba(0,120,255,0.3)', thickness: 0.1, numLines: 16 }}
            hideButtonText="💬"
        >
            <ConversationView visible={visible} />
        </GenericPanel>
    )
}

export default ConversationPanel
