interface Task {
    title: string
    due?: string
    notes?: string
    completed: boolean
}

interface TasksData {
    tasks: Task[]
}

function formatDue(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    } catch {
        return iso
    }
}

export default function TasksPanelContent({ data }: { data: unknown }) {
    const d = data as TasksData
    const pending = d.tasks.filter((t) => !t.completed)
    const done = d.tasks.filter((t) => t.completed)

    return (
        <div
            style={{
                padding: '12px',
                paddingTop: '44px',
                color: '#e0e0e0',
                fontFamily: 'sans-serif'
            }}
        >
            {d.tasks.length === 0 ? (
                <div style={{ color: '#666', fontSize: '13px' }}>Aucune tâche.</div>
            ) : (
                <>
                    <TaskList tasks={pending} />
                    {done.length > 0 && (
                        <>
                            <div style={{ fontSize: '11px', color: '#666', margin: '10px 0 6px' }}>
                                Terminées
                            </div>
                            <TaskList tasks={done} dimmed />
                        </>
                    )}
                </>
            )}
        </div>
    )
}

function TaskList({ tasks, dimmed = false }: { tasks: Task[]; dimmed?: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tasks.map((t, i) => (
                <div
                    key={i}
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '7px',
                        padding: '8px 10px',
                        opacity: dimmed ? 0.5 : 1
                    }}
                >
                    <div
                        style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            border: `2px solid ${t.completed ? '#4caf50' : 'rgba(255,255,255,0.2)'}`,
                            background: t.completed ? '#4caf50' : 'transparent',
                            flexShrink: 0,
                            marginTop: '1px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px'
                        }}
                    >
                        {t.completed && '✓'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: '13px',
                                textDecoration: t.completed ? 'line-through' : 'none',
                                color: t.completed ? '#666' : '#e0e0e0'
                            }}
                        >
                            {t.title}
                        </div>
                        {t.due && (
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                📅 {formatDue(t.due)}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
