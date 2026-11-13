import type { Notice, Question } from '../../types/question'
import type { ClassRef, Teacher } from '../../types/user'

// 시연용 반 코드: 학생이 닉네임과 함께 입력한다.
export const CLASS_CODES: Record<string, ClassRef> = {
  DUCK23: { grade: 2, classNo: 3 },
  DUCK24: { grade: 2, classNo: 4 },
}

// 시연용 교사 코드
export const TEACHER_CODES: Record<string, Teacher> = {
  KIM23: {
    id: 't-kim',
    name: '김하늘',
    subjects: ['수학'],
    homeroom: { grade: 2, classNo: 3 },
    department: '교무부',
  },
  LEE24: {
    id: 't-lee',
    name: '이바다',
    subjects: ['국어'],
    homeroom: { grade: 2, classNo: 4 },
    department: '학생부',
  },
  PARK00: {
    id: 't-park',
    name: '박나래',
    subjects: [],
    homeroom: null,
    department: '상담실',
  },
}

export const SEED_NOTICES: Notice[] = [
  {
    id: 'n-1',
    title: '체험학습 신청 안내',
    senderName: '교무부',
    body: '교외 체험학습은 출발 7일 전까지 신청서를 앱으로 제출해 주세요. 종이 신청서는 받지 않습니다.',
    target: [
      { grade: 2, classNo: 3 },
      { grade: 2, classNo: 4 },
    ],
    sentAt: '2026-11-10T09:00:00+09:00',
  },
  {
    id: 'n-2',
    title: '2학기 기말고사 일정',
    senderName: '교무부',
    body: '기말고사는 12월 8일(화)부터 12월 11일(금)까지입니다. 시험 범위는 과목별 공지를 확인하세요.',
    target: [
      { grade: 2, classNo: 3 },
      { grade: 2, classNo: 4 },
    ],
    sentAt: '2026-11-12T09:00:00+09:00',
  },
]

// 교사 질문함이 비어 보이지 않도록 미리 넣어둔 질문
export const SEED_QUESTIONS: Question[] = [
  {
    id: 'q-seed-1',
    studentId: 's-seed-1',
    isAnonymous: true,
    author: { grade: 2, classNo: 3, nickname: null },
    originalText: '수행평가 보고서 분량이 몇 장이에요?',
    fiveW1H: {
      who: '2학년 3반 학생 (익명)',
      when: '이번 주 금요일 제출',
      where: null,
      what: '수학 수행평가 보고서 분량',
      how: '손글씨 또는 출력',
      why: '분량 기준을 몰라서',
    },
    rewrittenText:
      '이번 주 금요일까지 내는 수학 수행평가 보고서는 몇 장으로 써야 하나요? 손글씨와 출력 중 어떤 방식이어도 되나요?',
    category: '수행평가',
    status: 'received',
    assignee: { type: 'teacher', teacherId: 't-kim' },
    forwardReason: null,
    answer: null,
    createdAt: '2026-11-13T08:20:00+09:00',
  },
]
