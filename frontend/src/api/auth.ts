import type { Session, Student, Teacher } from '../types/user'
import type { LoginResponse } from './backend/types'
import { post, USE_MOCK } from './client'
import { delay } from './mock/db'
import { CLASS_CODES, TEACHER_CODES } from './mock/seed'

// ─── 실제 백엔드: 아이디 + 비밀번호 (세션 쿠키) ───

// POST /api/auth/login
// 닉네임을 이름으로 쓴다. 백엔드는 학년·반·부서를 주지 않으므로 비워 둔다.
export async function login(loginId: string, password: string): Promise<Session> {
  const id = loginId.trim()
  const res = await post<LoginResponse>('/api/auth/login', { loginId: id, password })
  const name = res.nickname || id
  if (res.role === 'STUDENT') {
    return { role: 'student', user: { id: String(res.userId), nickname: name, grade: 0, classNo: 0 } }
  }
  return {
    role: 'teacher',
    user: { id: String(res.userId), name, subjects: [], homeroom: null, department: null },
  }
}

// POST /api/auth/logout (실패해도 화면에서는 나간 것으로 처리)
export async function logout(): Promise<void> {
  if (USE_MOCK) return
  await post('/api/auth/logout').catch(() => undefined)
}

// ─── 목업: 회원가입 없이 코드로 입장 ───

// 학생 입장: 닉네임 + 반 코드
export async function enterAsStudent(nickname: string, classCode: string): Promise<Student> {
  await delay()
  const classRef = CLASS_CODES[classCode.trim().toUpperCase()]
  if (!classRef) throw new Error('반 코드를 다시 확인해 주세요.')
  const name = nickname.trim()
  if (!name) throw new Error('닉네임을 입력해 주세요.')
  // 같은 반 + 같은 닉네임이면 같은 학생으로 본다
  return { id: `s-${classRef.grade}-${classRef.classNo}-${name}`, nickname: name, ...classRef }
}

// 교사 입장: 교사 코드
export async function enterAsTeacher(teacherCode: string): Promise<Teacher> {
  await delay()
  const teacher = TEACHER_CODES[teacherCode.trim().toUpperCase()]
  if (!teacher) throw new Error('교사 코드를 다시 확인해 주세요.')
  return teacher
}
