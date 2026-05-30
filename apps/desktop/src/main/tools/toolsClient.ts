import logger from '../logger'
import { getToolByName, getAllTools, type ToolDef } from './toolsCatalogue'
import { pushTask } from '../taskQueue'

const SERVER_URLS: Record<string, string> = {
    'system-tools': 'http://127.0.0.1:7824',
    tools: 'http://127.0.0.1:3001'
}

export interface ToolCallRequest {
    tool: string
    args?: Record<string, unknown>
}

export interface ToolPanelPayload {
    type: string
    data: unknown
}

export interface ToolCallResult {
    result: string
    panel?: ToolPanelPayload
}

function buildUrl(tool: ToolDef, args: Record<string, unknown>): string {
    const base = SERVER_URLS[tool.server]
    const path = tool.path

    if (tool.method === 'GET' && tool.queryParams?.length) {
        const params = new URLSearchParams()
        for (const key of tool.queryParams) {
            if (args[key] !== undefined) params.set(key, String(args[key]))
        }
        const qs = params.toString()
        return qs ? `${base}${path}?${qs}` : `${base}${path}`
    }

    return `${base}${path}`
}

export async function executeTool(request: ToolCallRequest): Promise<ToolCallResult> {
    const { tool: toolName, args = {} } = request

    // Local tool: add_reminder (handled in-process, no HTTP call)
    if (toolName === 'add_reminder') {
        const { text, delay_minutes, due_at } = args
        if (!text) return { result: 'Error: text is required' }
        const dueAt = due_at
            ? new Date(due_at as string).getTime()
            : Date.now() + Number(delay_minutes ?? 5) * 60_000
        pushTask({ type: 'add-reminder', payload: { text: text as string, dueAt } })
        const inMin = Math.round((dueAt - Date.now()) / 60_000)
        return { result: `Rappel programmé dans ${inMin} minute${inMin !== 1 ? 's' : ''} : "${text}"` }
    }

    // Meta-tool: list all available tools
    if (toolName === 'list_tools') {
        const tools = getAllTools()
        const lines = tools.map((t) => {
            const argStr = t.args
                .map((a) => `${a.name}${a.required ? '' : '?'}: ${a.type}`)
                .join(', ')
            return `- ${t.name}(${argStr}): ${t.description}`
        })
        return { result: lines.join('\n') }
    }

    const tool = getToolByName(toolName)
    if (!tool) {
        return { result: `Error: unknown tool "${toolName}". Use list_tools to see available tools.` }
    }

    // Safety guard: destructive tools require explicit confirmation in args
    if (tool.requiresConfirmation && !args.confirmed) {
        logger.warn(`[toolsClient] Blocked "${toolName}" — confirmation required`)
        return { result: `Action "${toolName}" requires explicit user confirmation. Ask the user to confirm before calling this tool again with confirmed: true.` }
    }

    const url = buildUrl(tool, args)
    const options: RequestInit = {
        method: tool.method,
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000)
    }

    if (tool.method !== 'GET') {
        options.body = JSON.stringify(args)
    }

    logger.info(`[toolsClient] ${tool.method} ${url} args=${JSON.stringify(args)}`)

    try {
        const res = await fetch(url, options)
        const text = await res.text()

        if (!res.ok) {
            return { result: `Error ${res.status}: ${text}` }
        }

        // Parse JSON — detect rich panel response { result, panel } or legacy { data }
        try {
            const json = JSON.parse(text)
            if (json.panel && typeof json.result === 'string') {
                return { result: json.result, panel: json.panel as ToolPanelPayload }
            }
            const data = json.data ?? json
            return { result: JSON.stringify(data, null, 2) }
        } catch {
            return { result: text }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error(`[toolsClient] Tool "${toolName}" failed: ${msg}`)
        return { result: `Error calling ${toolName}: ${msg}` }
    }
}
