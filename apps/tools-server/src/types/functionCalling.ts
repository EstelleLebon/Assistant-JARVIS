import { ZodTypeAny } from 'zod'

export interface ToolDef<I = any, O = any> {
    name: string
    description: string
    schema: ZodTypeAny
    handler: (input: I) => Promise<O> | O
}

/** Payload attendu pour appeler un tool */
export interface FunctionCallingRequest {
    tool: string
    input: unknown
}

/** Erreur typée pour function calling */
export interface FunctionCallingError {
    error: string
    code: 'NOT_FOUND' | 'VALIDATION' | 'EXECUTION'
    details?: unknown
}

/** Réponse standardisée */
export type FunctionCallingResponse = { result: unknown } | FunctionCallingError
