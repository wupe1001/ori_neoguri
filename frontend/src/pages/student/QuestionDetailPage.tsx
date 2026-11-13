import { useParams } from 'react-router'

export default function QuestionDetailPage() {
  const { id } = useParams()
  return <h1>내 질문 상세 #{id}</h1>
}
