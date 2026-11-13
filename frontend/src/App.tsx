import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import StudentLayout from './layouts/StudentLayout'
import TeacherLayout from './layouts/TeacherLayout'
import RequireRole from './session/RequireRole'

import EntryPage from './pages/EntryPage'
import NotFoundPage from './pages/NotFoundPage'
import UiPreviewPage from './pages/UiPreviewPage'

import StudentHomePage from './pages/student/StudentHomePage'
import HelpPage from './pages/student/HelpPage'
import MyQuestionsPage from './pages/student/MyQuestionsPage'
import QuestionDetailPage from './pages/student/QuestionDetailPage'
import StudentNoticesPage from './pages/student/StudentNoticesPage'
import StudentSettingsPage from './pages/student/StudentSettingsPage'

import TeacherHomePage from './pages/teacher/TeacherHomePage'
import InboxPage from './pages/teacher/InboxPage'
import InboxDetailPage from './pages/teacher/InboxDetailPage'
import ClustersPage from './pages/teacher/ClustersPage'
import TeacherNoticesPage from './pages/teacher/TeacherNoticesPage'
import KnowledgePage from './pages/teacher/KnowledgePage'
import TeacherSettingsPage from './pages/teacher/TeacherSettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EntryPage />} />

        <Route
          path="student"
          element={
            <RequireRole role="student">
              <StudentLayout />
            </RequireRole>
          }
        >
          <Route index element={<StudentHomePage />} />
          {/* 질문하기는 홈(채팅)으로 합쳐졌다. 예전 주소로 오면 홈으로 보낸다 */}
          <Route path="ask" element={<Navigate to="/student" replace />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="questions" element={<MyQuestionsPage />} />
          <Route path="questions/:id" element={<QuestionDetailPage />} />
          <Route path="notices" element={<StudentNoticesPage />} />
          <Route path="settings" element={<StudentSettingsPage />} />
        </Route>

        <Route
          path="teacher"
          element={
            <RequireRole role="teacher">
              <TeacherLayout />
            </RequireRole>
          }
        >
          <Route index element={<TeacherHomePage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="inbox/:id" element={<InboxDetailPage />} />
          <Route path="clusters" element={<ClustersPage />} />
          <Route path="notices" element={<TeacherNoticesPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="settings" element={<TeacherSettingsPage />} />
        </Route>

        {/* 개발용: 공용 컴포넌트 미리보기 */}
        <Route path="ui" element={<UiPreviewPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
