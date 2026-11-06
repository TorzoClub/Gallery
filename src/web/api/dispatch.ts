import { postJson, unwrapApiResponse } from './http'

export { API_BASE, ApiError, unwrapApiResponse } from './http'

const __DISPATCH_TIMEOUT = 120_000

async function dispatch<T>(
  kind: 'query' | 'mutation',
  name: string,
  payload: unknown,
  admin: boolean,
): Promise<T> {
  const route = kind === 'query' ? 'query' : 'mutate'
  const response = await postJson(
    `${admin ? 'admin/' : ''}${route}/${name}`,
    { payload },
    { timeout: __DISPATCH_TIMEOUT },
  )
  return unwrapApiResponse<T>(response.status, response.data)
}

export function query<T>(name: string, payload: unknown = {}): Promise<T> {
  return dispatch<T>('query', name, payload, false)
}

export function mutate<T>(name: string, payload: unknown = {}): Promise<T> {
  return dispatch<T>('mutation', name, payload, false)
}
