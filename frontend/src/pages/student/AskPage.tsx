import { USE_MOCK } from '../../api/client'
import BackendAskFlow from './ask/BackendAskFlow'
import MockAskFlow from './ask/MockAskFlow'

// 질문하기: 실제 백엔드면 백엔드 AI 흐름, 아니면 목업 흐름
export default function AskPage() {
  return USE_MOCK ? <MockAskFlow /> : <BackendAskFlow />
}
