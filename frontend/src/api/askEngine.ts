import type { FiveW1H, Source } from '../types/question'
import type { Subject } from './backend/types'

// 채팅 질문하기가 쓰는 "대화 엔진".
// 실제 백엔드(ask.ts)와 목업(askMock.ts)이 같은 모양으로 답해서, 채팅 화면은 하나만 있으면 된다.

export type AskResult =
  // 육하원칙을 채워 달라고 한다. prefill은 미리 채워 둘 값 (AI가 정리했거나 전에 쓴 값)
  | { kind: 'needs_details'; questionId: string; prefill: FiveW1H; askedAgain: boolean }
  // AI가 다시 쓴 질문 → "이렇게 보낼까요?"
  | { kind: 'confirm'; questionId: string; rewritten: string }
  // AI가 과목을 못 정해서 학생이 고른다
  | { kind: 'needs_subject'; questionId: string }
  // 선생님께 보냄. 고민·위기 신호로 담임에게 바로 갔으면 crisisMessage가 있다
  | { kind: 'assigned'; questionId: string; toLabel: string; crisisMessage: string | null }
  // 공지·승인된 답으로 바로 답함. canEscalate면 [선생님께 물어보기]를 보여준다
  | { kind: 'notice_answered'; questionId: string; answer: string; sources: Source[]; canEscalate: boolean }
  // AI 처리 실패 → 다시 시도
  | { kind: 'failed'; questionId: string }
  // 욕설·비방 → 보내지 않음 (목업만)
  | { kind: 'blocked'; reason: string }
  // 고민·위기 신호 → 상담 연결 선택지 (목업만. 실제 백엔드는 assigned + crisisMessage로 온다)
  | { kind: 'crisis'; text: string }
  // 그 밖의 상태 → 내 질문에서 확인
  | { kind: 'other'; questionId: string }

export type AskEngine = {
  // 육하원칙 여섯 칸을 모두 채워야 하는지 (실제 백엔드는 필수)
  requireAllDetails: boolean
  // 익명 질문을 지원하는지 (실제 백엔드는 아직 미지원)
  supportsAnonymous: boolean
  submit: (text: string, isAnonymous: boolean) => Promise<AskResult>
  details: (questionId: string, f: FiveW1H) => Promise<AskResult>
  confirm: (questionId: string, content: string) => Promise<AskResult>
  chooseSubject: (questionId: string, subjectId: number) => Promise<AskResult>
  retry: (questionId: string) => Promise<AskResult>
  // 공지 답을 받은 뒤 선생님께 넘기기 (지원할 때만)
  escalate?: (questionId: string) => Promise<AskResult>
  getSubjects: () => Promise<Subject[]>
}
