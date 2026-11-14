import { get } from './client'

// GET /api/users/:userId → 닉네임. 한 번 불러온 사용자는 기억해 둔다 (목록을 5초마다 갱신해도 요청이 늘지 않게).
type UserResponse = { id: number; loginId: string; nickname: string; role: string }

const cache = new Map<string, Promise<string | null>>()

export function getNickname(userId: string | number | null | undefined): Promise<string | null> {
  if (userId === null || userId === undefined || userId === '') return Promise.resolve(null)
  const key = String(userId)
  let pending = cache.get(key)
  if (!pending) {
    pending = get<UserResponse>(`/api/users/${key}`)
      .then((u) => u.nickname || u.loginId)
      .catch(() => {
        cache.delete(key) // 실패하면 다음에 다시 시도한다
        return null
      })
    cache.set(key, pending)
  }
  return pending
}
