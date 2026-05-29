import React from 'react'
import GenericPanel from './GenericPanel'
import useNotificationStore from '../../store/notificationStore'

const NotificationPanel: React.FC = () => {
    const { notifications, dismissNotification, clearAll } = useNotificationStore()

    return (
        <GenericPanel
            panelId="notifications"
            title="Notifications"
            width={340}
            height="auto"
            visible={true}
            onClose={clearAll}
            onShow={() => {}}
            anchorIndex={99}
            connectionOptions={{ numLines: 4 }}
        >
            <div
                style={{
                    padding: '48px 14px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                }}
            >
                {notifications.map((n) => (
                    <div
                        key={n.id}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '10px 12px',
                            background: 'rgba(76,168,232,0.07)',
                            borderRadius: 10,
                            border: '1px solid rgba(76,168,232,0.18)'
                        }}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {n.title && (
                                <div
                                    style={{
                                        color: '#4ca8e8',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        marginBottom: 3,
                                        letterSpacing: 0.3,
                                        textTransform: 'uppercase'
                                    }}
                                >
                                    {n.title}
                                </div>
                            )}
                            <div
                                style={{
                                    color: 'rgba(255,255,255,0.85)',
                                    fontSize: 13,
                                    lineHeight: 1.4
                                }}
                            >
                                {n.message}
                            </div>
                        </div>
                        <button
                            onClick={() => dismissNotification(n.id)}
                            style={{
                                flexShrink: 0,
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                background: 'rgba(76,168,232,0.10)',
                                border: 'none',
                                color: '#4ca8e8',
                                fontSize: 16,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1
                            }}
                            title="Acquitter"
                            aria-label="Acquitter"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </GenericPanel>
    )
}

export default NotificationPanel
