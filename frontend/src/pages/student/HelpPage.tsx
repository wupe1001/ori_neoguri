import { useNavigate } from 'react-router'
import { ROUTES } from '../../routes'
import CrisisStep from './ask/CrisisStep'

// 홈의 "도움이 필요해요": 질문 없이 바로 담임·상담 선생님께 연결한다.
// 이름을 알릴지 먼저 물어보도록 익명으로 시작한다.
export default function HelpPage() {
  const navigate = useNavigate()
  return <CrisisStep text="" isAnonymous onBack={() => navigate(ROUTES.STUDENT.HOME)} />
}
