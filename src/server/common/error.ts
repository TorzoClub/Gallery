export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_PAYLOAD'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ADMIN_ONLY'
  | 'UNKNOWN_ACTION'
  | 'INTERNAL'

export type ApiError = Error & {
  _tag: 'ApiError'
  status: number
  code: ApiErrorCode
  details?: unknown
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): ApiError {
  return Object.assign(new Error(message), {
    _tag: 'ApiError' as const,
    status,
    code,
    details,
  })
}

export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    (error as Partial<ApiError>)._tag === 'ApiError' &&
    typeof (error as Partial<ApiError>).status === 'number'
  )
}

export function badRequest(message: string, details?: unknown): ApiError {
  return apiError(400, 'BAD_REQUEST', message, details)
}

export function notFound(message: string): ApiError {
  return apiError(404, 'NOT_FOUND', message)
}

export function conflict(message: string): ApiError {
  return apiError(409, 'CONFLICT', message)
}

export function forbidden(message: string): ApiError {
  return apiError(403, 'FORBIDDEN', message)
}
