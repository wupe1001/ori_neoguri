import type { Notice, Question } from '../../types/question'
import { SEED_NOTICES, SEED_QUESTIONS } from './seed'

// 목업 저장소: localStorage에 저장해서 학생 탭에서 보낸 질문이 교사 탭에도 보이게 한다.
const KEY = 'neoguri-mock-db'

type Db = {
  questions: Question[]
  notices: Notice[]
}

function seed(): Db {
  return { questions: structuredClone(SEED_QUESTIONS), notices: structuredClone(SEED_NOTICES) }
}

export function readDb(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch {
    // 저장소를 못 읽으면 초기 데이터로 시작
  }
  return seed()
}

export function writeDb(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // 저장 실패는 무시 (시연용)
  }
}

// 시연 전에 데이터를 처음 상태로 되돌린다. 콘솔에서 호출하거나 버튼에 연결해서 쓴다.
export function resetDb() {
  writeDb(seed())
}

// 실제 네트워크처럼 약간 기다린다 (로딩 화면 확인용)
export function delay(ms = 400) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
