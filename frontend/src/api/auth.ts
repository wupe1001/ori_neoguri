import type { Student, Teacher } from '../types/user'
import { delay } from './mock/db'
import { CLASS_CODES, TEACHER_CODES } from './mock/seed'

// TODO(백엔드): POST /api/auth/student 로 교체

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

// TODO(백엔드): POST /api/auth/teacher 로 교체

// 교사 입장: 교사 코드
export async function enterAsTeacher(teacherCode: string): Promise<Teacher> {
  await delay()
  const teacher = TEACHER_CODES[teacherCode.trim().toUpperCase()]
  if (!teacher) throw new Error('교사 코드를 다시 확인해 주세요.')
  return teacher
}
