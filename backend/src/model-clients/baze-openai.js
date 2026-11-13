import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { config } from '../config.js';
import { ModelError } from '../errors.js';

const answerSchema = z.object({ answer: z.string().trim().min(1).max(5000) }).strict();
export const improvementStage1Schema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  exampleAnswers: z.array(z.string().trim().min(1).max(2000)).min(2).max(5),
}).strict();
export const improvementStage2Schema = z.object({
  prompt: z.string().trim().min(1).max(2000),
}).strict();
export const improvementStage3Schema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  candidates: z.array(z.object({
    question: z.string().trim().min(1).max(2000),
    type: z.string().trim().min(1).max(200),
    bloomLevel: z.string().trim().min(1).max(200),
  }).strict()).min(2).max(4),
}).strict();
export const finalQuestionSuggestionSchema = z.object({
  suggestedQuestion: z.string().trim().min(1).max(2000),
}).strict();

function invalidResponse(message, details = {}) {
  return new ModelError('MODEL_INVALID_RESPONSE', message, { retryable: true, details });
}

function getOutputText(response) {
  const textParts = [];
  for (const item of response?.output || []) {
    if (item?.type !== 'message' || item.role !== 'assistant') continue;
    for (const content of item.content || []) {
      if (content?.type === 'refusal') {
        throw invalidResponse('생성 모델이 요청 처리를 거부했습니다.');
      }
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        textParts.push(content.text);
      }
    }
  }
  return textParts.join('').trim();
}

export function parseGenerationResponse(response, schema, fieldName) {
  if (response?.status !== 'completed') {
    throw invalidResponse('생성 모델 응답이 완료되지 않았습니다.', {
      status: response?.status,
      incompleteDetails: response?.incomplete_details,
    });
  }

  if (response.output_parsed != null) {
    const parsed = schema.safeParse(response.output_parsed);
    if (parsed.success) return parsed.data;
    throw invalidResponse('생성 모델의 구조화된 결과가 올바르지 않습니다.', { issues: parsed.error.issues });
  }

  const outputText = getOutputText(response);
  if (!outputText) throw invalidResponse('생성 모델 응답에 텍스트 결과가 없습니다.');

  let candidate;
  try {
    candidate = JSON.parse(outputText);
  } catch {
    // 일부 OpenAI 호환 API는 Structured Outputs 요청에도 일반 텍스트를
    // 반환하므로, 단일 필드 결과로 정규화한 뒤 동일한 스키마로 검증한다.
    candidate = { [fieldName]: outputText };
  }

  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    throw invalidResponse('생성 모델의 텍스트 결과가 올바르지 않습니다.', { issues: parsed.error.issues });
  }
  return parsed.data;
}

export class BazeGenerationModel {
  constructor(client = new OpenAI({ apiKey: config.bazeApiKey, baseURL: config.bazeBaseUrl, maxRetries: 0 })) {
    this.client = client;
  }

  async parse(input, schema, schemaName, fieldName) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.modelTimeoutMs);
    try {
      // create()로 원본 Responses API 응답을 받아 호환 API가 SDK 전용
      // output_parsed 필드를 만들지 않는 경우도 직접 처리한다.
      const response = await this.client.responses.create({
        model: config.generationModel,
        input,
        text: { format: zodTextFormat(schema, schemaName) },
      }, { signal: controller.signal });
      return parseGenerationResponse(response, schema, fieldName);
    } catch (error) {
      if (error instanceof ModelError) throw error;
      const status = error?.status;
      const mapping = { 400: ['MODEL_REQUEST_INVALID', false], 401: ['MODEL_AUTH_FAILED', false], 402: ['MODEL_CREDIT_EXHAUSTED', false], 403: ['MODEL_ACCESS_DENIED', false], 404: ['MODEL_NOT_FOUND', false], 429: ['MODEL_RATE_LIMITED', true] };
      const [code, retryable] = mapping[status] || (status >= 500 ? ['MODEL_PROVIDER_UNAVAILABLE', true] : ['MODEL_NETWORK_ERROR', true]);
      throw new ModelError(code, '생성 모델 호출에 실패했습니다.', { retryable, cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateImprovementStage1(originalQuestion) {
    const input = [
      '학생의 원 질문만 바탕으로 질문 개선 1단계를 생성하세요.',
      '학생이 어디까지 알고 어디에서 막혔는지 묻는 하나의 간결한 한국어 프롬프트와, 응답에 참고할 서로 다른 예시 답변 2~5개를 만드세요.',
      '학생이 번호가 아니라 예시 문장 또는 자유 텍스트로 답할 수 있게 작성하세요.',
      `원 질문: ${originalQuestion}`,
    ].join('\n');
    return this.parse(input, improvementStage1Schema, 'improvement_stage_1', 'prompt');
  }

  async generateImprovementStage2(history) {
    const input = [
      '다음 질문 개선 이력을 바탕으로 2단계를 생성하세요.',
      '질문 유형을 미리 분류하지 말고, 학생이 헷갈린 실제 문장·문제·상황 등 적절한 사례 하나를 적도록 요청하는 간결한 한국어 프롬프트 하나만 만드세요.',
      JSON.stringify(history),
    ].join('\n');
    return this.parse(input, improvementStage2Schema, 'improvement_stage_2', 'prompt');
  }

  async generateImprovementStage3(history) {
    const input = [
      '다음 질문 개선 전체 이력을 바탕으로 3단계를 생성하세요.',
      '학생의 궁금증을 서로 다른 깊이로 표현한 질문 후보 2~4개와, 학생이 후보를 골라 자유롭게 고치도록 안내하는 간결한 한국어 프롬프트를 만드세요.',
      '각 후보에는 질문 본문, 질문 유형, 적절한 블룸 분류 수준을 포함하세요. 후보 ID는 만들지 마세요.',
      JSON.stringify(history),
    ].join('\n');
    return this.parse(input, improvementStage3Schema, 'improvement_stage_3', 'prompt');
  }

  async generateFinalQuestionSuggestion(history) {
    const input = [
      '학생이 질문 개선 과정을 지금 단계에서 마치려 합니다.',
      '원 질문과 지금까지 실제로 저장된 개선 이력만 반영해, 교사나 공지 답변 파이프라인에 바로 전달할 수 있는 최종 질문 예시 하나를 간결한 한국어로 작성하세요.',
      '학생이 답하지 않은 단계의 정보를 추측하거나 새로운 사실을 추가하지 마세요.',
      JSON.stringify(history),
    ].join('\n');
    return this.parse(input, finalQuestionSuggestionSchema, 'final_question_suggestion', 'suggestedQuestion');
  }

  async answerFromNotices(question, notices) {
    const material = notices.map((notice) => `[공지 ${notice.id}] ${notice.title}\n${notice.content}`).join('\n\n');
    const input = `선택된 공지사항 내용만을 근거로 학생 질문에 간결한 한국어로 답하세요. 공지에 없는 사실은 추측하지 마세요.\n\n학생 질문: ${question}\n\n공지사항:\n${material}`;
    return (await this.parse(input, answerSchema, 'notice_answer', 'answer')).answer;
  }
}
