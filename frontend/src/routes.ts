// 앱의 모든 경로는 여기서만 정의한다. 링크는 이 상수를 사용한다.
export const ROUTES = {
  ROOT: '/',
  // 개발용: 공용 컴포넌트 미리보기
  UI_PREVIEW: '/ui',

  STUDENT: {
    HOME: '/student',
    ASK: '/student/ask',
    QUESTIONS: '/student/questions',
    QUESTION_DETAIL: (id: string | number) => `/student/questions/${id}`,
    NOTICES: '/student/notices',
    SETTINGS: '/student/settings',
  },

  TEACHER: {
    HOME: '/teacher',
    INBOX: '/teacher/inbox',
    INBOX_DETAIL: (id: string | number) => `/teacher/inbox/${id}`,
    CLUSTERS: '/teacher/clusters',
    NOTICES: '/teacher/notices',
    KNOWLEDGE: '/teacher/knowledge',
    SETTINGS: '/teacher/settings',
  },
} as const
