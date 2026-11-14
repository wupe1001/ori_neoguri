import { useEffect, useState } from 'react'

// fetcher를 처음 한 번, 그 뒤로 intervalMs마다 불러와 값을 돌려준다 (탭바 뱃지용)
// 실패하면 이전 값을 그대로 둔다.
export function usePolling<T>(fetcher: () => Promise<T>, initial: T, intervalMs = 15000): T {
  const [value, setValue] = useState<T>(initial)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetcher()
        .then((v) => {
          if (!cancelled) setValue(v)
        })
        .catch(() => undefined)
    load()
    const timer = window.setInterval(load, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [fetcher, intervalMs])

  return value
}
