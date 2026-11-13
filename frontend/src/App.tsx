import { BrowserRouter, Route, Routes } from 'react-router'

import StudentLayout from './layouts/StudentLayout'
import TeacherLayout from './layouts/TeacherLayout'

import RoleSelectPage from './pages/RoleSelectPage'
import NotFoundPage from './pages/NotFoundPage'

import StudentHomePage from './pages/student/StudentHomePage'
import AskPage from './pages/student/AskPage'
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
        <Route path="/" element={<RoleSelectPage />} />

        <Route path="student" element={<StudentLayout />}>
          <Route index element={<StudentHomePage />} />
          <Route path="ask" element={<AskPage />} />
          <Route path="questions" element={<MyQuestionsPage />} />
          <Route path="questions/:id" element={<QuestionDetailPage />} />
          <Route path="notices" element={<StudentNoticesPage />} />
          <Route path="settings" element={<StudentSettingsPage />} />
        </Route>

        <Route path="teacher" element={<TeacherLayout />}>
          <Route index element={<TeacherHomePage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="inbox/:id" element={<InboxDetailPage />} />
          <Route path="clusters" element={<ClustersPage />} />
          <Route path="notices" element={<TeacherNoticesPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="settings" element={<TeacherSettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
