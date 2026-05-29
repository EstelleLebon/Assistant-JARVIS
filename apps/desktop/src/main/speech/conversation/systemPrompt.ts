import type { ToolDef } from '../../tools/toolsCatalogue'

export type ModelType = 'llama-fast-assistant' | 'qwen-main-assistant' | 'mistral-agent'

export interface SystemPromptOptions {
    model?: ModelType
    lang?: 'fr' | 'en' | string
    enableFunctionCalling?: boolean
    tools?: ToolDef[]
    memoryContext?: string
}

// ─── Per-model config ─────────────────────────────────────────────────────────

interface ModelConfig {
    prefix?: string
    personality: (language: string) => string
    toolRules: string
}

const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
    'llama-fast-assistant': {
        personality: (language) =>
            `You are JARVIS, a fast local voice assistant.
Respond in ${language}. Voice interface — no markdown, no bullet points, no lists.
Be concise: 1–2 sentences unless explicitly asked for more.
Avoid warnings, disclaimers, and filler phrases.
Never invent facts. If you don't know, say so.`,
        toolRules:
            'Tool call rule: when a tool is needed, your ENTIRE response must be the JSON object and nothing else — no text before, no text after, no explanation.\nNever fabricate tool results. Ask if a required argument is missing.'
    },

    'qwen-main-assistant': {
        // /no_think disables extended thinking mode at the prompt level (belt-and-suspenders with think:false in API)
        prefix: '/no_think',
        personality: (language) =>
            `You are JARVIS, an advanced local voice assistant running on a private machine.
Voice interface: never use markdown, bullet points, headers, or code blocks in regular responses. Speak in natural, flowing sentences.

Language: ${language} by default. Switch automatically if the user speaks another language.

Response style:
- 1–3 sentences for conversational exchanges.
- Detailed explanations only when explicitly requested.
- Adapt technical depth to the user's apparent expertise.
- Maintain context and remember stated preferences across the conversation.

Accuracy: never hallucinate. If uncertain, say so and offer what you do know.`,
        toolRules:
            'Tools: you already have full access — call them immediately without asking for permission. Emit valid structured JSON only. Never fabricate outputs. Ask one focused clarifying question only if a required argument is truly missing.'
    },

    'mistral-agent': {
        personality: (language) =>
            `You are JARVIS, a local autonomous assistant specialized in task execution and tool use.
Language: ${language}.
Voice interface: no markdown, no bullet points. Plain spoken sentences only.

Execution rules:
- Solve tasks directly and efficiently.
- Minimize explanations unless asked.
- One action at a time — confirm before chaining irreversible operations.
- Never fabricate results or invent data.`,
        toolRules: `Tool calling rules:
- Prefer tools over speculation when a tool can resolve the task.
- Output valid JSON only — no surrounding text, no markdown fences.
- If a required argument is missing, ask for it before calling.
- Report tool failures clearly and suggest an alternative.`
    }
}

// ─── Layer builders ───────────────────────────────────────────────────────────

function contextLayer(): string {
    const now = new Date()
    return `Current date and time: ${now.toLocaleString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    })}`
}

function toolsLayer(tools: ToolDef[]): string {
    if (!tools.length) return ''
    const lines: string[] = [
        'Available tools:',
        'To call a tool, respond ONLY with a single-line JSON object — no text before or after, no markdown:',
        '{"tool": "tool_name", "args": {"arg1": "value1"}}',
        '',
        'Tool list:'
    ]
    for (const t of tools) {
        const argStr = t.args
            .map((a) => `${a.name}${a.required ? '' : '?'}: ${a.type} — ${a.description}`)
            .join('; ')
        lines.push(`- ${t.name}: ${t.description}${argStr ? ` | args: ${argStr}` : ''}`)
    }
    lines.push('- list_tools: Discover all available tools')
    lines.push('')
    lines.push('After receiving a tool result, continue the conversation naturally.')
    return lines.join('\n')
}

// ─── Compositor ───────────────────────────────────────────────────────────────

export function createSystemPrompt(options: SystemPromptOptions = {}): string {
    const {
        model = 'llama-fast-assistant',
        lang = 'fr',
        enableFunctionCalling = false,
        tools,
        memoryContext
    } = options

    const language = lang === 'fr' ? 'French' : lang === 'en' ? 'English' : lang
    const config = MODEL_CONFIGS[model] ?? MODEL_CONFIGS['llama-fast-assistant']

    const layers: (string | undefined)[] = [
        config.prefix,
        config.personality(language),
        contextLayer(),
        enableFunctionCalling ? config.toolRules : undefined,
        tools?.length ? toolsLayer(tools) : undefined,
        memoryContext || undefined
    ]

    return layers.filter(Boolean).join('\n\n').trim()
}
