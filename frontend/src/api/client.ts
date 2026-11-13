// 실제 백엔드와 통신하는 공통 요청 함수

// .env.local 의 VITE_API_MODE=real 이면 실제 백엔드, 아니면 목업
export const USE_MOCK = import.meta.env.VITE_API_MODE !== 'real'

export class ApiError extends Error {
  status: number
  code: string | null

  constructor(message: string, status: number, code: string | null) {
    super(message)
    this.status = status
    this.code = code
  }
}

// 로그인이 풀렸을 때(401) 알린다. SessionProvider가 받아서 입장 화면으로 보낸다.
export const UNAUTHORIZED_EVENT = 'neoguri:unauthorized'

type Method = 'GET' | 'POST'

// /api 로 시작하는 경로를 그대로 쓴다. 개발 서버 프록시가 백엔드로 넘겨준다.
export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'include', // 세션 쿠키
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('서버에 연결하지 못했어요. 인터넷이나 서버 상태를 확인해 주세요.', 0, null)
  }

  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // 백엔드 에러 형식: { error: { code, message, details } }
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    if (res.status === 401 && path !== '/api/auth/login') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(err?.message ?? `요청에 실패했어요 (${res.status})`, res.status, err?.code ?? null)
  }
  return data as T
}

export const get = <T>(path: string) => request<T>('GET', path)
export const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {})
