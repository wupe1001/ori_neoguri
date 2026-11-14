import type { QuestionCandidate, Source } from '../types/question'
import type { Subject } from './backend/types'

// 채팅 질문하기가 쓰는 "대화 엔진".
// 실제 백엔드(ask.ts)와 목업(askMock.ts)이 같은 모양으로 답해서, 채팅 화면은 하나만 있으면 된다.
//
// 정보가 부족한 질문은 4단계로 다듬는다:
//   1. 막힌 곳 찾기 (stuck) → 2. 구체화하기 (example) → 3. 질문 틀 보여주기 (pick) → 4. 학생이 고르고 고치기

export type AskResult =
  // 1단계: 어디서 막혔는지 묻는다. examples는 학생이 참고할 예시 답변
  | { kind: 'stuck'; questionId: string; prompt: string; examples: string[] }
  // 2단계: 실제로 헷갈렸던 문장·문제를 묻는다
  | { kind: 'example'; questionId: string; prompt: string }
  // 3단계: 질문 후보를 보여주고, 학생이 하나를 골라 고친 뒤 확정한다
  | { kind: 'pick'; questionId: string; prompt: string; candidates: QuestionCandidate[] }
  // 건너뛰기: 지금까지 답한 내용으로 AI가 만든 질문 하나. 학생이 고쳐서 확정한다
  | { kind: 'suggested'; questionId: string; suggestion: string }
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
  // 익명 질문을 지원하는지 (실제 백엔드는 아직 미지원)
  supportsAnonymous: boolean
  // files: 질문에 붙인 사진 (처음 보낼 때만 올릴 수 있다)
  submit: (text: string, isAnonymous: boolean, files?: File[]) => Promise<AskResult>
  answerStuck: (questionId: string, answer: string) => Promise<AskResult> // 1단계 답
  answerExample: (questionId: string, answer: string) => Promise<AskResult> // 2단계 답
  // 1·2단계에서 남은 단계를 건너뛰고 AI가 최종 질문 하나를 만든다
  skipToFinal: (questionId: string) => Promise<AskResult>
  finalize: (questionId: string, content: string) => Promise<AskResult> // 최종 질문 확정
  chooseSubject: (questionId: string, subjectId: number) => Promise<AskResult>
  retry: (questionId: string) => Promise<AskResult>
  // 공지 답을 받은 뒤 선생님께 넘기기 (지원할 때만)
  escalate?: (questionId: string) => Promise<AskResult>
  // 중간에 멈춘 질문을 지금 상태부터 이어서 하기 (지원할 때만)
  resume?: (questionId: string) => Promise<{ question: string; result: AskResult }>
  getSubjects: () => Promise<Subject[]>
}
