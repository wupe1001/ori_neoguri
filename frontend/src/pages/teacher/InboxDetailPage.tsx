import { useParams } from 'react-router'

export default function InboxDetailPage() {
  const { id } = useParams()
  return <h1>질문 상세 #{id}</h1>
}
