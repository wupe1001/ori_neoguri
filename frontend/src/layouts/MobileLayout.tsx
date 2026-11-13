import { NavLink, Outlet } from 'react-router'

export type Tab = {
  to: string
  label: string
  end?: boolean
}

type Props = {
  tabs: Tab[]
  // 탭바에 넣지 못한 설정 화면 링크. 있으면 상단 오른쪽에 표시한다.
  settingsTo?: string
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-semibold text-primary-700' : 'text-muted'

// 학생·교사 공용 모바일 레이아웃: 최대 480px 폭, 둥근 플로팅 탭바
export default function MobileLayout({ tabs, settingsTo }: Props) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[480px] flex-col border-x border-line bg-surface">
      {settingsTo && (
        <header className="sticky top-0 flex justify-end bg-surface px-4 pt-3 pb-1 text-caption">
          <NavLink to={settingsTo} className={linkClass}>
            설정
          </NavLink>
        </header>
      )}

      <main className="flex-1 p-4">
        <Outlet />
      </main>

      <nav className="sticky bottom-3 mx-3 mb-3 flex justify-around rounded-full border border-line bg-surface px-1 py-2 text-caption shadow-lg">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-full px-2 py-1 ${isActive ? 'bg-primary-100 font-semibold text-primary-700' : 'text-muted'}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
