export type ToolServer = 'system-tools' | 'tools' | 'client'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

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
    /** Args interpolated into the URL path (e.g. :id) */
    pathParams?: string[]
    /** Args passed as query params */
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
        pendingPhrase: () => `J'ouvre le navigateur...`
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
        pendingPhrase: () => `Je lance la recherche...`
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
        pendingPhrase: () => `J'ouvre Youtube et recherche...`
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
        pendingPhrase: () => `Je règle le volume...`
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
            },
            {
                name: 'days',
                type: 'number',
                required: false,
                description: 'Number of forecast days (1–7, default: 1)'
            }
        ],
        server: 'tools',
        method: 'GET',
        path: '/tools/weather',
        queryParams: ['location', 'units', 'days'],
        default: true,
        pendingPhrase: () => `J'interroge la météo...`
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
        name: 'system_open_folder',
        description: 'Open a folder in the file manager',
        args: [{ name: 'path', type: 'string', required: true, description: 'Folder path' }],
        server: 'system-tools',
        method: 'POST',
        path: '/tools/system/open-folder',
        default: false,
        pendingPhrase: () => `J'ouvre le dossier...`
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
        pendingPhrase: () => `Je lance l'application...`
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
            },
            {
                name: 'time_zone',
                type: 'string',
                required: false,
                description:
                    'IANA timezone (e.g. Europe/Paris). Defaults to Europe/Paris if omitted.'
            }
        ],
        server: 'tools',
        method: 'POST',
        path: '/tools/calendar/events',
        default: false,
        pendingPhrase: () => `Je crée l'événement...`
    },
    {
        name: 'calendar_update',
        description: 'Update an existing Google Calendar event',
        args: [
            { name: 'id', type: 'string', required: true, description: 'Event ID' },
            { name: 'summary', type: 'string', required: false, description: 'New event title' },
            {
                name: 'start',
                type: 'string',
                required: false,
                description: 'New start time ISO 8601'
            },
            { name: 'end', type: 'string', required: false, description: 'New end time ISO 8601' },
            {
                name: 'description',
                type: 'string',
                required: false,
                description: 'New description'
            },
            { name: 'location', type: 'string', required: false, description: 'New location' },
            {
                name: 'time_zone',
                type: 'string',
                required: false,
                description: 'IANA timezone (default: Europe/Paris)'
            },
            {
                name: 'calendar_id',
                type: 'string',
                required: false,
                description: 'Calendar ID (default: primary)'
            }
        ],
        server: 'tools',
        method: 'PUT',
        path: '/tools/calendar/events/:id',
        pathParams: ['id'],
        default: false,
        pendingPhrase: () => `Je modifie l'événement...`
    },
    {
        name: 'calendar_delete',
        description: 'Delete a Google Calendar event',
        args: [
            { name: 'id', type: 'string', required: true, description: 'Event ID' },
            {
                name: 'calendar_id',
                type: 'string',
                required: false,
                description: 'Calendar ID (default: primary)'
            }
        ],
        server: 'tools',
        method: 'DELETE',
        path: '/tools/calendar/events/:id',
        pathParams: ['id'],
        queryParams: ['calendar_id'],
        default: false,
        requiresConfirmation: true,
        pendingPhrase: () => `Je supprime l'événement...`
    },
    {
        name: 'tasks_list',
        description: 'List Google Tasks',
        args: [
            {
                name: 'list_id',
                type: 'string',
                required: true,
                description: 'Task list ID (use tasks_lists to get available IDs)'
            },
            {
                name: 'status',
                type: "'needsAction'|'completed'",
                required: false,
                description: 'Filter by status'
            },
            {
                name: 'due_min',
                type: 'string',
                required: false,
                description: 'Min due date ISO 8601'
            },
            {
                name: 'due_max',
                type: 'string',
                required: false,
                description: 'Max due date ISO 8601'
            }
        ],
        server: 'tools',
        method: 'GET',
        path: '/tools/tasks',
        queryParams: ['list_id', 'status', 'due_min', 'due_max'],
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
        pendingPhrase: () => `J'ajoute la tâche...`
    },
    {
        name: 'tasks_update',
        description: 'Update a Google Task (e.g. mark complete, change due date)',
        args: [
            { name: 'id', type: 'string', required: true, description: 'Task ID' },
            { name: 'title', type: 'string', required: false, description: 'New title' },
            { name: 'notes', type: 'string', required: false, description: 'New notes' },
            { name: 'due', type: 'string', required: false, description: 'New due date ISO 8601' },
            {
                name: 'status',
                type: "'needsAction'|'completed'",
                required: false,
                description: 'Task status'
            },
            {
                name: 'list_id',
                type: 'string',
                required: false,
                description: 'Task list ID (default: primary)'
            }
        ],
        server: 'tools',
        method: 'PUT',
        path: '/tools/tasks/:id',
        pathParams: ['id'],
        default: false,
        pendingPhrase: () => `Je mets à jour la tâche...`
    },
    {
        name: 'tasks_delete',
        description: 'Delete a Google Task',
        args: [
            { name: 'id', type: 'string', required: true, description: 'Task ID' },
            {
                name: 'list_id',
                type: 'string',
                required: false,
                description: 'Task list ID (default: primary)'
            }
        ],
        server: 'tools',
        method: 'DELETE',
        path: '/tools/tasks/:id',
        pathParams: ['id'],
        queryParams: ['list_id'],
        default: false,
        requiresConfirmation: true,
        pendingPhrase: () => `Je supprime la tâche...`
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
        name: 'routines_get',
        description: 'Get the list of daily routine items',
        args: [
            {
                name: 'date',
                type: 'string',
                required: false,
                description: 'Date YYYY-MM-DD (default: today)'
            }
        ],
        server: 'tools',
        method: 'GET',
        path: '/tools/routines',
        queryParams: ['date'],
        default: false,
        pendingPhrase: () => `Je consulte tes routines...`
    },
    {
        name: 'routines_check',
        description: 'Mark a routine item as done for today',
        args: [
            {
                name: 'item_id',
                type: 'number',
                required: true,
                description: 'Routine item ID (from routines_get)'
            },
            {
                name: 'date',
                type: 'string',
                required: false,
                description: 'Date YYYY-MM-DD (default: today)'
            }
        ],
        server: 'tools',
        method: 'POST',
        path: '/tools/routines/check',
        default: false,
        pendingPhrase: () => `Je marque la routine comme faite...`
    },
    {
        name: 'routines_uncheck',
        description: 'Unmark a routine item as done',
        args: [
            { name: 'item_id', type: 'number', required: true, description: 'Routine item ID' },
            {
                name: 'date',
                type: 'string',
                required: false,
                description: 'Date YYYY-MM-DD (default: today)'
            }
        ],
        server: 'tools',
        method: 'POST',
        path: '/tools/routines/uncheck',
        default: false,
        pendingPhrase: () => `Je décoche la routine...`
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
        pendingPhrase: () => `Je cherche dans ma mémoire...`
    },
    {
        name: 'memory_context',
        description:
            'Retrieve contextual memory snippets relevant to a topic (facts + past episodes combined)',
        args: [
            {
                name: 'q',
                type: 'string',
                required: true,
                description: 'Topic or question to get context for'
            },
            {
                name: 'limit',
                type: 'number',
                required: false,
                description: 'Max results (default: 5)'
            }
        ],
        server: 'tools',
        method: 'GET',
        path: '/tools/memory/context',
        queryParams: ['q', 'limit'],
        default: false,
        pendingPhrase: () => `Je consulte ma mémoire...`
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
        // Handled client-side in toolsClient.ts — no HTTP route
        server: 'client',
        method: 'POST',
        path: '/tools/reminders',
        default: true,
        pendingPhrase: () => `Je programme un rappel...`
    },
    {
        name: 'list_reminders',
        description:
            'List all pending (not yet delivered) reminders with their IDs and scheduled times',
        args: [],
        // Handled client-side in toolsClient.ts — no HTTP route
        server: 'client',
        method: 'GET',
        path: '/tools/reminders',
        default: true,
        pendingPhrase: () => `Je consulte les rappels en attente...`
    },
    {
        name: 'delete_reminder',
        description:
            'Delete a pending reminder by its position number (1-based, as shown by list_reminders)',
        args: [
            {
                name: 'number',
                type: 'number',
                required: true,
                description: 'Position number of the reminder to delete (1 = first in list)'
            }
        ],
        // Handled client-side in toolsClient.ts — no HTTP route
        server: 'client',
        method: 'DELETE',
        path: '/tools/reminders/0',
        default: true,
        pendingPhrase: () => `Je supprime le rappel...`
    },
    {
        name: 'update_reminder',
        description:
            'Update a pending reminder text or scheduled time by its position number (1-based, as shown by list_reminders)',
        args: [
            {
                name: 'number',
                type: 'number',
                required: true,
                description: 'Position number of the reminder to update (1 = first in list)'
            },
            {
                name: 'text',
                type: 'string',
                required: false,
                description: 'New reminder text (omit to keep existing)'
            },
            {
                name: 'due_at',
                type: 'string',
                required: false,
                description: 'New scheduled time ISO 8601 (use this OR delay_minutes)'
            },
            {
                name: 'delay_minutes',
                type: 'number',
                required: false,
                description: 'New delay from now in minutes (use this OR due_at)'
            }
        ],
        // Handled client-side in toolsClient.ts — no HTTP route
        server: 'client',
        method: 'PUT',
        path: '/tools/reminders/0',
        default: true,
        pendingPhrase: () => `Je modifie le rappel...`
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
