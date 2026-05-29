export type ErrorCode =
    | 'INVALID_PARAMS'
    | 'RESOURCE_NOT_FOUND'
    | 'COMMAND_FAILED'
    | 'DEPENDENCY_MISSING'
    | 'CONFIRMATION_REQUIRED'
    | 'INTERNAL_ERROR'

export interface ApiSuccess<T> {
    success: true
    data: T
}

export interface ApiError {
    success: false
    error: {
        code: ErrorCode
        message: string
    }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export function ok<T>(data: T): ApiSuccess<T> {
    return { success: true, data }
}

export function err(code: ErrorCode, message: string): ApiError {
    return { success: false, error: { code, message } }
}
