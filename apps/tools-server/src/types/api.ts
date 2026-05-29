export type ApiSuccess<T> = { success: true; data: T }
export type ApiError = { success: false; error: { code: string; message: string } }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

export function ok<T>(data: T): ApiSuccess<T> {
    return { success: true, data }
}

export function err(code: string, message: string): ApiError {
    return { success: false, error: { code, message } }
}
