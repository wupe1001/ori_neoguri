import type { Notice, Question } from '../../types/question'
import type { ClassRef, Teacher } from '../../types/user'

// 시연 날짜와 상관없이 "3시간 전"처럼 보이도록 지금 기준으로 날짜를 만든다
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

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
    sentAt: hoursAgo(24 * 3),
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
    sentAt: hoursAgo(24 + 2),
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
    rewrittenText:
      '이번 주 금요일까지 내는 수학 수행평가 보고서는 몇 장으로 써야 하나요? 손글씨와 출력 중 어떤 방식이어도 되나요?',
    category: '수행평가',
    status: 'received',
    assignee: { type: 'teacher', teacherId: 't-kim' },
    forwardReason: null,
    answer: null,
    createdAt: hoursAgo(3),
  },
  // 질문 묶음 시연용: 이차함수 꼭짓점에서 2명이 막힘
  {
    id: 'q-seed-2',
    studentId: 's-seed-2',
    isAnonymous: false,
    author: { grade: 2, classNo: 3, nickname: '감자' },
    originalText: '이차함수 꼭짓점은 어떻게 구해요?',
    rewrittenText:
      '어제 수학 수업 관련 질문이에요. 숙제 문제를 못 풀어서 여쭤봐요. 이차함수 꼭짓점은 어떻게 구해요? 완전제곱식으로 하면 되는지도 궁금해요.',
    category: '교과',
    status: 'received',
    assignee: { type: 'teacher', teacherId: 't-kim' },
    forwardReason: null,
    answer: null,
    createdAt: hoursAgo(2),
  },
  {
    id: 'q-seed-3',
    studentId: 's-seed-3',
    isAnonymous: true,
    author: { grade: 2, classNo: 3, nickname: null },
    originalText: '이차함수 그래프 그릴 때 꼭짓점부터 찍어야 해요?',
    rewrittenText: '이차함수 그래프 그릴 때 꼭짓점부터 찍어야 해요?',
    category: '교과',
    status: 'received',
    assignee: { type: 'teacher', teacherId: 't-kim' },
    forwardReason: null,
    answer: null,
    createdAt: hoursAgo(1),
  },
  {
    id: 'q-seed-4',
    studentId: 's-seed-4',
    isAnonymous: true,
    author: { grade: 2, classNo: 3, nickname: null },
    originalText: '체험학습 신청서 종이로 내도 되나요?',
    rewrittenText:
      '다음 주 관련 질문이에요. 가족 행사 때문에 여쭤봐요. 체험학습 신청서 종이로 내도 되나요? 종이 신청서(으)로 하면 되는지도 궁금해요.',
    category: '생활',
    status: 'received',
    assignee: { type: 'teacher', teacherId: 't-kim' },
    forwardReason: null,
    answer: null,
    createdAt: hoursAgo(20),
  },
  {
    id: 'q-seed-5',
    studentId: 's-seed-2',
    isAnonymous: false,
    author: { grade: 2, classNo: 3, nickname: '감자' },
    originalText: '기말고사 수학 시험 범위가 어디까지예요?',
    rewrittenText: '기말고사 관련 질문이에요. 기말고사 수학 시험 범위가 어디까지예요?',
    category: '교과',
    status: 'received',
    assignee: { type: 'teacher', teacherId: 't-kim' },
    forwardReason: null,
    answer: null,
    createdAt: hoursAgo(24 * 8),
  },
]
