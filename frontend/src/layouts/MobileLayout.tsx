import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

export type Tab = {
  to: string
  label: string
  end?: boolean
  badge?: number // 0보다 크면 빨간 숫자 뱃지
}

type Props = {
  tabs: Tab[]
  // 탭바에 넣지 못한 설정 화면 링크. 있으면 상단 오른쪽에 표시한다.
  settingsTo?: string
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-semibold text-primary-600' : 'text-muted hover:text-ink'

type Pill = { left: number; top: number; width: number; height: number }

// 학생·교사 공용 모바일 레이아웃: 최대 480px 폭, 둥근 플로팅 탭바
export default function MobileLayout({ tabs, settingsTo }: Props) {
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<Pill | null>(null)
  // 처음 자리 잡을 때는 미끄러지지 않고, 그 뒤 탭을 바꿀 때만 미끄러진다
  const [animate, setAnimate] = useState(false)
  // 뱃지 숫자가 바뀌면 탭 폭도 바뀌므로 다시 잰다
  const badgeKey = tabs.map((t) => t.badge ?? 0).join()

  // 선택된 탭 위치를 재서 파란 알약을 그 자리로 옮긴다
  useLayoutEffect(() => {
    const measure = () => {
      const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
      setPill(
        active
          ? { left: active.offsetLeft, top: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight }
          : null,
      )
    }
    measure()
    const id = requestAnimationFrame(() => setAnimate(true))
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', measure)
    }
  }, [pathname, badgeKey])

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[480px] flex-col bg-page sm:border-x sm:border-line">
      {settingsTo && (
        <header className="sticky top-0 z-10 flex justify-end bg-page/90 px-4 pt-3 pb-1 text-caption backdrop-blur">
          <NavLink to={settingsTo} className={linkClass}>
            설정
          </NavLink>
        </header>
      )}

      {/* 화면이 바뀔 때마다 살짝 떠오르며 나타난다 */}
      <main key={pathname} className="page-in flex-1 p-4">
        <Outlet />
      </main>

      <nav
        ref={navRef}
        className="sticky bottom-3 z-10 mx-3 mb-3 flex justify-around rounded-full border border-line/70 bg-surface/95 px-1.5 py-1.5 text-caption shadow-lg shadow-navy/10 backdrop-blur"
      >
        {pill && (
          <span
            aria-hidden
            className={`absolute rounded-full bg-primary-600 shadow-sm shadow-primary-600/30 ${animate ? 'transition-all duration-300 ease-out' : ''}`}
            style={pill}
          />
        )}
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `relative rounded-full px-3 py-1.5 transition-colors duration-300 ${isActive ? 'font-semibold text-white' : 'text-muted hover:text-ink'}`
            }
          >
            {tab.label}
            {!!tab.badge && (
              <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[11px] leading-4 font-bold text-white">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
