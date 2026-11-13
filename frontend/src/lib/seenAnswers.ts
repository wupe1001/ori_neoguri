// 학생이 이미 확인한 답 (홈의 "새로 온 답" 알림용).
// 이 브라우저에만 저장된다. 백엔드가 읽음 여부를 관리하면 교체한다.
const key = (studentId: string) => `neoguri-seen-answers-${studentId}`

export function getSeenAnswerIds(studentId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key(studentId)) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function markAnswerSeen(studentId: string, questionId: string) {
  try {
    const seen = getSeenAnswerIds(studentId)
    if (!seen.includes(questionId)) localStorage.setItem(key(studentId), JSON.stringify([...seen, questionId]))
  } catch {
    // 저장 실패는 무시
  }
}
