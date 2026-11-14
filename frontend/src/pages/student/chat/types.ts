import type { AskResult } from '../../../api/askEngine'

// AI 말풍선이 보여주는 내용: 엔진 결과 + 화면에서만 생기는 몇 가지
export type AiContent =
  | AskResult
  | { kind: 'crisis_sent' } // 상담 연결 요청을 보냄
  | { kind: 'resolved' } // 공지 답으로 해결
  | { kind: 'error'; message: string }

export type ChatItem =
  | { id: string; role: 'user'; text: string; files?: File[] } // files: 함께 보낸 사진
  // active: 아직 학생이 답해야 하는 말풍선 (버튼·입력칸이 살아 있다)
  | { id: string; role: 'ai'; content: AiContent; active: boolean }
