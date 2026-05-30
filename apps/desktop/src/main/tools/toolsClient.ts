import logger from '../logger'
import { getToolByName, getAllTools, type ToolDef } from './toolsCatalogue'
import { pushTask } from '../taskQueue'
import { getPendingReminders, deleteReminder } from '../heartbeat/reminderStore'

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
    const base = SERVER_URLS[tool.server as 'tools' | 'system-tools']
    let path = tool.path

    // Interpolate path params (e.g. :id)
    if (tool.pathParams?.length) {
        for (const key of tool.pathParams) {
            if (args[key] !== undefined) {
                path = path.replace(`:${key}`, encodeURIComponent(String(args[key])))
            }
        }
    }

    if (tool.queryParams?.length) {
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
        return {
            result: `Rappel programmé dans ${inMin} minute${inMin !== 1 ? 's' : ''} : "${text}"`
        }
    }

    // Local tool: list_reminders
    if (toolName === 'list_reminders') {
        const pending = getPendingReminders().sort((a, b) => a.dueAt - b.dueAt)
        if (pending.length === 0) return { result: 'Aucun rappel programmé.' }
        const lines = pending.map((r, i) => {
            const date = new Date(r.dueAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
            return `${i + 1}. "${r.text}" — ${date}`
        })
        return { result: lines.join('\n') }
    }

    // Local tool: delete_reminder — accepts 1-based position number from list_reminders
    if (toolName === 'delete_reminder') {
        const { number } = args
        if (!number)
            return { result: 'Error: number is required (1-based index from list_reminders)' }
        const pending = getPendingReminders().sort((a, b) => a.dueAt - b.dueAt)
        const idx = Number(number) - 1
        if (idx < 0 || idx >= pending.length)
            return {
                result: `Rappel numéro ${number} introuvable. Il y a ${pending.length} rappel(s) en attente.`
            }
        const deleted = deleteReminder(pending[idx].id)
        return {
            result: deleted
                ? `Rappel ${number} supprimé : "${pending[idx].text}"`
                : `Erreur lors de la suppression.`
        }
    }

    // Local tool: update_reminder — change text or due time by position number
    if (toolName === 'update_reminder') {
        const { number, text, due_at, delay_minutes } = args
        if (!number)
            return { result: 'Error: number is required (1-based index from list_reminders)' }
        const pending = getPendingReminders().sort((a, b) => a.dueAt - b.dueAt)
        const idx = Number(number) - 1
        if (idx < 0 || idx >= pending.length)
            return {
                result: `Rappel numéro ${number} introuvable. Il y a ${pending.length} rappel(s) en attente.`
            }
        const old = pending[idx]
        deleteReminder(old.id)
        const newText = (text as string | undefined) ?? old.text
        const newDueAt = due_at
            ? new Date(due_at as string).getTime()
            : delay_minutes !== undefined
              ? Date.now() + Number(delay_minutes) * 60_000
              : old.dueAt
        pushTask({ type: 'add-reminder', payload: { text: newText, dueAt: newDueAt } })
        const date = new Date(newDueAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
        return { result: `Rappel ${number} mis à jour : "${newText}" — ${date}` }
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
        return {
            result: `Error: unknown tool "${toolName}". Use list_tools to see available tools.`
        }
    }

    // Safety guard: destructive tools require explicit confirmation in args
    if (tool.requiresConfirmation && !args.confirmed) {
        logger.warn(`[toolsClient] Blocked "${toolName}" — confirmation required`)
        return {
            result: `Action "${toolName}" requires explicit user confirmation. Ask the user to confirm before calling this tool again with confirmed: true.`
        }
    }

    const url = buildUrl(tool, args)
    const body = tool.method !== 'GET' ? JSON.stringify(args) : undefined

    logger.info(`[toolsClient] ${tool.method} ${url} args=${JSON.stringify(args)}`)

    const RETRY_DELAYS = [500, 1500]
    let lastErr: unknown
    let res: Response | undefined

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        if (attempt > 0) {
            const delay = RETRY_DELAYS[attempt - 1]
            logger.warn(
                `[toolsClient] "${toolName}" retry ${attempt}/${RETRY_DELAYS.length} in ${delay}ms`
            )
            await new Promise((r) => setTimeout(r, delay))
        }
        try {
            res = await fetch(url, {
                method: tool.method,
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(8000),
                ...(body !== undefined ? { body } : {})
            })
            break
        } catch (err) {
            lastErr = err
        }
    }

    if (!res) {
        const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
        logger.error(`[toolsClient] "${toolName}" failed after retries: ${msg}`)
        return { result: `Error calling ${toolName}: ${msg}` }
    }

    try {
        const text = await res.text()

        if (!res.ok) {
            return { result: `Error ${res.status}: ${text}` }
        }

        // Parse JSON — detect rich panel response { result, panel } or legacy { data }
        try {
            const json = JSON.parse(text)
            if (typeof json.result === 'string') {
                const panel =
                    json.panel &&
                    typeof json.panel === 'object' &&
                    typeof json.panel.type === 'string'
                        ? (json.panel as ToolPanelPayload)
                        : undefined
                return { result: json.result, panel }
            }
            // Handle ok/err wrapper: { ok: false, error: string }
            if (json.ok === false) {
                return { result: `Error: ${json.error ?? 'unknown error'}` }
            }
            const data = json.data ?? json
            return { result: JSON.stringify(data, null, 2) }
        } catch {
            return { result: text }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error(`[toolsClient] Tool "${toolName}" read error: ${msg}`)
        return { result: `Error calling ${toolName}: ${msg}` }
    }
}
