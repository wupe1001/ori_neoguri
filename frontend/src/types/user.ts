export type Department = '교무부' | '학생부' | '행정실' | '상담실'

export type ClassRef = {
  grade: number // 학년
  classNo: number // 반
}

// 학생: 닉네임 + 반 코드로 입장
export type Student = ClassRef & {
  id: string
  nickname: string
}

// 교사: 교사 코드로 입장. 담당 정보가 질문함 분류 기준이 된다.
export type Teacher = {
  id: string
  name: string
  subjects: string[] // 담당 과목
  homeroom: ClassRef | null // 담임 반
  department: Department // 소속 부서
}

export type Session =
  | { role: 'student'; user: Student }
  | { role: 'teacher'; user: Teacher }
