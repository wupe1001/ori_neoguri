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

// 학생·교사 공용 모바일 레이아웃: 최대 480px 폭, 하단 탭바
export default function MobileLayout({ tabs, settingsTo }: Props) {
  return (
    <div className="mobile-layout">
      {settingsTo && (
        <header className="mobile-header">
          <NavLink to={settingsTo}>설정</NavLink>
        </header>
      )}
      <main className="mobile-content">
        <Outlet />
      </main>
      <nav className="mobile-tabbar">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
