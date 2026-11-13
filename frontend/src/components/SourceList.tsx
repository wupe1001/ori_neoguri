import type { Source } from '../types/question'

const typeLabel: Record<Source['type'], string> = {
  notice: '공지',
  approved_answer: '승인된 답',
  schedule: '학사일정',
}

// 답의 출처 목록
export default function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null
  return (
    <div className="mt-3 border-t border-line pt-2">
      <p className="text-caption font-semibold text-muted">출처</p>
      <ul className="mt-1 flex flex-col gap-1">
        {sources.map((s) => (
          <li key={`${s.type}-${s.title}`} className="text-caption text-muted">
            [{typeLabel[s.type]}] {s.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
