export type ToolServer = 'system-tools' | 'tools'
export type HttpMethod = 'GET' | 'POST' | 'DELETE'

export interface ToolArgDef {
    name: string
    type: string
    required: boolean
    description: string
}

export interface ToolDef {
    name: string
    description: string
    args: ToolArgDef[]
    server: ToolServer
    method: HttpMethod
    path: string
    /** Args passed as query params (for GET requests) */
    queryParams?: string[]
    /** Exposed to LLM by default without discovery */
    default: boolean
    /** Spoken aloud while the tool executes, with args interpolated */
    pendingPhrase?: (args: Record<string, unknown>) => string
    /** Requires explicit user confirmation before execution */
    requiresConfirmation?: boolean
}

export const TOOLS_CATALOGUE: ToolDef[] = [
    // ── Default tools ──────────────────────────────────────────────
    {
        name: 'browser_open',
        description: 'Open a URL in the default browser',
        args: [{ name: 'url', type: 'string', required: true, description: 'URL to open' }],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/browser/open',
        default: true,
        pendingPhrase: (args) => `J'ouvre ${args.url}...`
    },
    {
        name: 'browser_search',
        description: 'Search the web and open results in browser',
        args: [
            { name: 'query', type: 'string', required: true, description: 'Search query' },
            {
                name: 'engine',
                type: "'duckduckgo'|'google'",
                required: false,
                description: 'Search engine (default: duckduckgo)'
            }
        ],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/browser/search',
        default: true,
        pendingPhrase: (args) => `Je recherche "${args.query}"...`
    },
    {
        name: 'browser_youtube',
        description: 'Search and open YouTube in browser',
        args: [
            { name: 'query', type: 'string', required: true, description: 'Search query' },
            {
                name: 'autoplay',
                type: 'boolean',
                required: false,
                description: 'Auto-play first result'
            }
        ],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/browser/youtube',
        default: true,
        pendingPhrase: (args) => `Je cherche "${args.query}" sur YouTube...`
    },
    {
        name: 'media_play_pause',
        description: 'Toggle play/pause for current media player',
        args: [],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/media/play-pause',
        default: true,
        pendingPhrase: () => `Je mets en pause...`
    },
    {
        name: 'media_next',
        description: 'Skip to next track',
        args: [],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/media/next',
        default: true,
        pendingPhrase: () => `Je passe à la suite...`
    },
    {
        name: 'media_previous',
        description: 'Go to previous track',
        args: [],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/media/previous',
        default: true,
        pendingPhrase: () => `Je reviens en arrière...`
    },
    {
        name: 'media_volume',
        description: 'Set system volume level',
        args: [
            {
                name: 'level',
                type: 'number',
                required: true,
                description: 'Volume level 0-100'
            }
        ],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/media/volume',
        default: true,
        pendingPhrase: (args) => `Je règle le volume à ${args.level}...`
    },
    {
        name: 'notify',
        description: 'Send a desktop notification',
        args: [
            { name: 'title', type: 'string', required: true, description: 'Notification title' },
            {
                name: 'message',
                type: 'string',
                required: true,
                description: 'Notification body'
            },
            {
                name: 'urgency',
                type: "'low'|'normal'|'critical'",
                required: false,
                description: 'Urgency level'
            },
            {
                name: 'duration_ms',
                type: 'number',
                required: false,
                description: 'Duration in milliseconds'
            }
        ],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/system/notification',
        default: true,
        pendingPhrase: (args) => `J'envoie une notification : ${args.title}...`
    },
    {
        name: 'weather_get',
        description: 'Get current weather for a city',
        args: [
            {
                name: 'location',
                type: 'string',
                required: true,
                description: 'City name or location'
            },
            {
                name: 'units',
                type: "'metric'|'imperial'",
                required: false,
                description: 'Temperature units'
            }
        ],
        server: 'tools',
        method: 'GET',
        path: '/tools/weather',
        queryParams: ['location', 'units'],
        default: true,
        pendingPhrase: (args) => `J'interroge la météo à ${args.location}...`
    },

    // ── Discoverable tools ─────────────────────────────────────────
    {
        name: 'system_lock',
        description: 'Lock the screen',
        args: [],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/system/lock',
        default: false,
        requiresConfirmation: true,
        pendingPhrase: () => `Je verrouille l'écran...`
    },
    {
        name: 'system_sleep',
        description: 'Put the computer to sleep',
        args: [],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/system/sleep',
        default: false,
        requiresConfirmation: true,
        pendingPhrase: () => `Je mets l'ordinateur en veille...`
    },
    {
        name: 'system_shutdown',
        description: 'Shutdown the computer (requires confirmed: true)',
        args: [
            {
                name: 'confirmed',
                type: 'boolean',
                required: true,
                description: 'Must be true to confirm shutdown'
            },
            {
                name: 'delay_seconds',
                type: 'number',
                required: false,
                description: 'Delay before shutdown'
            }
        ],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/system/shutdown',
        default: false,
        requiresConfirmation: true,
        pendingPhrase: () => `J'éteins l'ordinateur...`
    },
    {
        name: 'system_screenshot',
        description: 'Take a screenshot',
        args: [
            {
                name: 'output_dir',
                type: 'string',
                required: false,
                description: 'Output directory'
            },
            { name: 'filename', type: 'string', required: false, description: 'File name' }
        ],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/system/screenshot',
        default: false,
        pendingPhrase: () => `Je prends une capture d'écran...`
    },
    {
        name: 'system_open_file',
        description: 'Open a file with its default application',
        args: [{ name: 'path', type: 'string', required: true, description: 'File path' }],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/system/open-file',
        default: false,
        pendingPhrase: () => `J'ouvre le fichier...`
    },
    {
        name: 'system_launch_app',
        description: 'Launch an application by name',
        args: [
            {
                name: 'name',
                type: 'string',
                required: true,
                description: 'Application name or command'
            }
        ],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/system/launch-app',
        default: false,
        pendingPhrase: (args) => `Je lance ${args.name}...`
    },
    {
        name: 'vscode_open',
        description: 'Open a folder in VS Code',
        args: [
            {
                name: 'path',
                type: 'string',
                required: false,
                description: 'Folder path or alias name'
            },
            { name: 'alias', type: 'string', required: false, description: 'VS Code alias name' }
        ],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/vscode/open',
        default: false
    },
    {
        name: 'vscode_list_folders',
        description: 'List saved VS Code folder aliases',
        args: [],
        server: 'system-tools',
        method: 'GET',
        path: '/tools/vscode/folders',
        default: false
    },
    {
        name: 'calendar_list',
        description: 'List Google Calendar events. Defaults to today if no dates given.',
        args: [
            {
                name: 'date_start',
                type: 'string',
                required: false,
                description: 'Start of range ISO 8601 (default: today 00:00)'
            },
            {
                name: 'date_end',
                type: 'string',
                required: false,
                description: 'End of range ISO 8601 (default: today 23:59)'
            },
            {
                name: 'max_results',
                type: 'number',
                required: false,
                description: 'Max number of events (default: 10)'
            }
        ],
        server: 'tools',
        method: 'GET',
        path: '/tools/calendar/events',
        queryParams: ['date_start', 'date_end', 'max_results'],
        default: false,
        pendingPhrase: () => `Je consulte ton agenda...`
    },
    {
        name: 'calendar_create',
        description: 'Create a Google Calendar event',
        args: [
            { name: 'summary', type: 'string', required: true, description: 'Event title' },
            {
                name: 'start',
                type: 'string',
                required: true,
                description: 'Start time ISO 8601'
            },
            { name: 'end', type: 'string', required: true, description: 'End time ISO 8601' },
            {
                name: 'description',
                type: 'string',
                required: false,
                description: 'Event description'
            }
        ],
        server: 'tools',
        method: 'POST',
        path: '/tools/calendar/events',
        default: false,
        pendingPhrase: (args) => `Je crée l'événement "${args.summary}"...`
    },
    {
        name: 'tasks_list',
        description: 'List Google Tasks',
        args: [
            {
                name: 'list_id',
                type: 'string',
                required: false,
                description: 'Task list ID (default: primary)'
            }
        ],
        server: 'tools',
        method: 'GET',
        path: '/tools/tasks',
        queryParams: ['list_id'],
        default: false,
        pendingPhrase: () => `Je consulte tes tâches...`
    },
    {
        name: 'tasks_create',
        description: 'Create a Google Task',
        args: [
            { name: 'title', type: 'string', required: true, description: 'Task title' },
            { name: 'notes', type: 'string', required: false, description: 'Task notes' },
            {
                name: 'due',
                type: 'string',
                required: false,
                description: 'Due date ISO 8601'
            }
        ],
        server: 'tools',
        method: 'POST',
        path: '/tools/tasks',
        default: false,
        pendingPhrase: (args) => `J'ajoute la tâche "${args.title}"...`
    },
    {
        name: 'routines_status',
        description: 'Get daily routine completion status',
        args: [],
        server: 'tools',
        method: 'GET',
        path: '/tools/routines/status',
        default: false,
        pendingPhrase: () => `Je vérifie tes routines...`
    },
    {
        name: 'memory_search',
        description: 'Search Jarvis long-term memory (facts and past events) by keyword',
        args: [
            {
                name: 'q',
                type: 'string',
                required: true,
                description: 'Keyword or phrase to search for'
            },
            {
                name: 'limit',
                type: 'number',
                required: false,
                description: 'Max results per type (default: 5)'
            }
        ],
        server: 'tools',
        method: 'GET',
        path: '/tools/memory/search',
        queryParams: ['q', 'limit'],
        default: false,
        pendingPhrase: (args) => `Je cherche dans ma mémoire : ${args.q}...`
    },
    {
        name: 'add_reminder',
        description: 'Set a reminder that Jarvis will announce aloud at the specified time',
        args: [
            {
                name: 'text',
                type: 'string',
                required: true,
                description: 'Reminder message to announce'
            },
            {
                name: 'delay_minutes',
                type: 'number',
                required: false,
                description: 'Minutes from now (use this OR due_at)'
            },
            {
                name: 'due_at',
                type: 'string',
                required: false,
                description: 'ISO 8601 datetime for the reminder (use this OR delay_minutes)'
            }
        ],
        server: 'tools',
        method: 'POST',
        path: '/tools/reminders',
        default: true,
        pendingPhrase: (args) => `Je programme un rappel dans ${args.delay_minutes ?? '?'} minutes...`
    },
    {
        name: 'memory_save_fact',
        description: 'Save a fact about the user to long-term memory',
        args: [
            {
                name: 'content',
                type: 'string',
                required: true,
                description: 'The fact to remember, as a clear self-contained sentence'
            },
            {
                name: 'category',
                type: "'declarative'|'behavioral'",
                required: false,
                description: 'Memory category (default: declarative)'
            },
            {
                name: 'confidence',
                type: 'number',
                required: false,
                description: 'Confidence 0.0–1.0 (default: 1.0)'
            }
        ],
        server: 'tools',
        method: 'POST',
        path: '/tools/memory/facts',
        default: false,
        pendingPhrase: () => `Je mémorise ça...`
    }
]

export function getDefaultTools(): ToolDef[] {
    return TOOLS_CATALOGUE.filter((t) => t.default)
}

export function getAllTools(): ToolDef[] {
    return TOOLS_CATALOGUE
}

export function getToolByName(name: string): ToolDef | undefined {
    return TOOLS_CATALOGUE.find((t) => t.name === name)
}
