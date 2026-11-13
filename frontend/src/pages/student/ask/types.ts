// 질문하기 화면의 단계
export type AskStep =
  | 'write' // 질문 쓰기
  | 'crisis' // 위기 신호 → 상담 연결 안내
  | 'chatbot' // 챗봇 답
  | 'refine' // 육하원칙 확인 (빈칸 채우기)
  | 'confirm' // "이렇게 보낼까요?"
  | 'sent' // 선생님께 보냄
  | 'resolved' // 챗봇 답으로 해결
