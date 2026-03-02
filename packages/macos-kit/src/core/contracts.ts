import { randomUUID } from 'node:crypto'

export type ErrorCode =
  | 'UNSUPPORTED_PLATFORM'
  | 'FEATURE_DISABLED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'SAFETY_BLOCKED'
  | 'PERMISSION_DENIED'
  | 'EXECUTION_TIMEOUT'
  | 'EXECUTION_FAILED'
  | 'DEPENDENCY_MISSING'
  | 'INTERNAL_ERROR'

export interface FailureBody {
  code: ErrorCode
  message: string
  hint?: string
  retryable: boolean
}

export interface ResponseMeta {
  trace_id: string
  execution_time_seconds?: number
}

export interface ContractResponse<T = unknown> {
  ok: boolean
  data: T | null
  error: FailureBody | null
  meta: ResponseMeta
}

export function buildSuccess<T>(
  data: T,
  meta: Partial<ResponseMeta> = {}
): ContractResponse<T> {
  return {
    ok: true,
    data,
    error: null,
    meta: {
      trace_id: meta.trace_id ?? randomUUID(),
      execution_time_seconds: meta.execution_time_seconds,
    },
  }
}

export function buildFailure(
  code: ErrorCode,
  message: string,
  options: {
    hint?: string
    retryable?: boolean
    execution_time_seconds?: number
    trace_id?: string
  } = {}
): ContractResponse<null> {
  return {
    ok: false,
    data: null,
    error: {
      code,
      message,
      hint: options.hint,
      retryable: options.retryable ?? false,
    },
    meta: {
      trace_id: options.trace_id ?? randomUUID(),
      execution_time_seconds: options.execution_time_seconds,
    },
  }
}

export function toToolResult(response: ContractResponse) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
    isError: !response.ok,
  }
}
