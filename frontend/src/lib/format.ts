import type { Question } from '../types/question'

// 질문 작성자 표시: 익명이면 "2학년 3반 학생 (익명)", 아니면 "2학년 3반 오리".
// 학년·반을 모르면 (실제 백엔드) 이름만 보여준다.
export function authorLabel(author: Question['author']) {
  const cls = classLabel(author)
  if (!cls) return author.nickname ?? '학생 (익명)'
  return author.nickname ? `${cls} ${author.nickname}` : `${cls} 학생 (익명)`
}

// "방금", "5분 전", "3시간 전", "11월 12일"
export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

// 다른 부서로 넘어갔으면 "교무부로 전달됨", 아니면 null
export function forwardedLabel(q: Question) {
  return q.status === 'forwarded' && q.assignee.type === 'department' ? `${q.assignee.department}로 전달됨` : null
}

// "2학년 3반". 학년·반을 모르면 (실제 백엔드) null
export function classLabel(c: { grade: number; classNo: number }) {
  return c.grade > 0 ? `${c.grade}학년 ${c.classNo}반` : null
}
