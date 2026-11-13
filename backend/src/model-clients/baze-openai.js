import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { config } from '../config.js';
import { ModelError } from '../errors.js';

const rewriteSchema = z.object({ rewrittenQuestion: z.string().trim().min(1).max(2000) }).strict();
const answerSchema = z.object({ answer: z.string().trim().min(1).max(5000) }).strict();

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

  async rewriteQuestion(originalQuestion, details) {
    const input = [
      '다음 학생의 원 질문과 육하원칙 정보를 모두 반영해 교사가 이해하기 쉬운 하나의 간결한 한국어 질문으로 재작성하세요. 정보를 추측하거나 추가하지 마세요.',
      `원 질문: ${originalQuestion}`,
      `누가: ${details.who}`,
      `언제: ${details.when}`,
      `어디서: ${details.where}`,
      `무엇을: ${details.what}`,
      `어떻게: ${details.how}`,
      `왜: ${details.why}`,
    ].join('\n');
    return (await this.parse(input, rewriteSchema, 'rewritten_question', 'rewrittenQuestion')).rewrittenQuestion;
  }

  async answerFromNotices(question, notices) {
    const material = notices.map((notice) => `[공지 ${notice.id}] ${notice.title}\n${notice.content}`).join('\n\n');
    const input = `선택된 공지사항 내용만을 근거로 학생 질문에 간결한 한국어로 답하세요. 공지에 없는 사실은 추측하지 마세요.\n\n학생 질문: ${question}\n\n공지사항:\n${material}`;
    return (await this.parse(input, answerSchema, 'notice_answer', 'answer')).answer;
  }
}
