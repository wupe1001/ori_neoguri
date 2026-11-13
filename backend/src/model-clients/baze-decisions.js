import { z } from 'zod';
import { config } from '../config.js';
import { ModelError, mapModelHttpError } from '../errors.js';

const noulAnswer = z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }).strict();
const choiceAnswer = z.object({
  type: z.literal('choice'),
  choice: z.string().min(1),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
}).strict();
const decisionUsage = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
}).passthrough();
const decisionResponse = z.object({
  id: z.string().min(1),
  object: z.literal('decisions'),
  model: z.string().min(1),
  model_version: z.string().optional(),
  answers: z.record(z.string(), z.discriminatedUnion('type', [noulAnswer, choiceAnswer])),
  usage: decisionUsage,
  request_id: z.string().optional(),
}).strict();

function invalidResponse(message, details = {}) {
  return new ModelError('MODEL_INVALID_RESPONSE', message, { retryable: true, details });
}

export function parseJevResponse(body, expectedKeys) {
  const parsed = decisionResponse.safeParse(body);
  if (!parsed.success) {
    throw invalidResponse('판단 모델 응답 구조가 올바르지 않습니다.', { issues: parsed.error.issues });
  }

  const expected = [...expectedKeys].sort();
  const actual = Object.keys(parsed.data.answers).sort();
  if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
    throw invalidResponse('판단 모델의 질문 키가 요청과 일치하지 않습니다.', { expected, actual });
  }
  return parsed.data;
}

export class BazeDecisionModel {
  async request(state, questions) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.modelTimeoutMs);
    let response;
    try {
      response = await fetch(`${config.bazeBaseUrl}/decisions/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.bazeApiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': config.bazeUserAgent,
        },
        body: JSON.stringify({ model: config.decisionModel, state, questions }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new ModelError('MODEL_NETWORK_ERROR', '판단 모델 네트워크 요청에 실패했습니다.', { retryable: true, cause: error });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw mapModelHttpError(response.status, response.headers.get('retry-after'));

    let body;
    try {
      body = await response.json();
    } catch (error) {
      throw invalidResponse('판단 모델이 JSON이 아닌 응답을 반환했습니다.', { cause: error.message });
    }
    return parseJevResponse(body, Object.keys(questions));
  }

  normalizeNoul(response, key) {
    const answer = response.answers[key];
    if (answer.type !== 'noul') throw invalidResponse(`${key} 응답 유형이 noul이 아닙니다.`);
    return {
      value: answer.noul >= 0.5,
      probability: answer.noul,
      confidence: Math.max(answer.noul, 1 - answer.noul),
      probabilities: { false: 1 - answer.noul, true: answer.noul },
      provider: 'BAZE', model: config.decisionModel, modelVersion: response.model_version || response.model || null,
    };
  }

  async detectCrisis(question) {
    const response = await this.request({ question }, {
      is_crisis: { type: 'noul', instructions: '학생 질문에 정서적 고민, 괴롭힘, 학대, 자해, 타해 또는 즉시 관심이 필요한 위기 신호가 있습니까?' },
    });
    return this.normalizeNoul(response, 'is_crisis');
  }

  async checkSufficiency(question) {
    const response = await this.request({ question }, {
      is_sufficient: { type: 'noul', instructions: '교사가 추가 정보 없이 이 질문에 정확하고 구체적으로 답할 만큼 질문 내용이 충분합니까?' },
    });
    return this.normalizeNoul(response, 'is_sufficient');
  }

  async matchNotices(question, notices) {
    if (!notices.length) return { answerable: false, noticeIds: [], decisions: [], provider: 'BAZE', model: config.decisionModel, modelVersion: null };
    const state = { question, notices: notices.map(({ id, title, content }) => ({ id, title, content })) };
    const decisions = [];
    for (let offset = 0; offset < notices.length; offset += 32) {
      const chunk = notices.slice(offset, offset + 32);
      const questions = Object.fromEntries(chunk.map((notice) => [
        `NOTICE_${notice.id}`,
        { type: 'noul', instructions: `공지사항 ID ${notice.id}의 내용만으로 학생 질문의 답변에 직접 근거를 제공할 수 있습니까?` },
      ]));
      const response = await this.request(state, questions);
      for (const notice of chunk) {
        const key = `NOTICE_${notice.id}`;
        const normalized = this.normalizeNoul(response, key);
        decisions.push({ noticeId: notice.id, ...normalized });
      }
    }
    const noticeIds = decisions.filter((item) => item.probability >= config.thresholds.notice).map((item) => item.noticeId);
    return { answerable: noticeIds.length > 0, noticeIds, decisions, provider: 'BAZE', model: config.decisionModel, modelVersion: decisions[0]?.modelVersion || null };
  }

  async classifySubject(question, subjects) {
    if (subjects.length < 2) {
      if (subjects.length === 1) return { subjectId: subjects[0].id, confidence: 1, probabilities: { [`SUBJECT_${subjects[0].id}`]: 1 }, provider: 'APPLICATION', model: 'single-subject', modelVersion: null };
      throw invalidResponse('분류할 과목이 없습니다.');
    }
    const criteria = Object.fromEntries(subjects.map((subject) => [`SUBJECT_${subject.id}`, subject.name]));
    const response = await this.request({ question }, {
      subject: { type: 'choice', instructions: '이 학생 질문을 답변하기에 가장 적합한 과목을 정확히 하나 선택하세요.', criteria },
    });
    const answer = response.answers.subject;
    if (answer.type !== 'choice') throw invalidResponse('과목 분류 응답 유형이 choice가 아닙니다.');
    const allowed = new Set(Object.keys(criteria));
    if (!allowed.has(answer.choice) || Object.keys(answer.probabilities).some((key) => !allowed.has(key))) throw invalidResponse('과목 분류 결과에 요청하지 않은 선택지가 있습니다.');
    const match = /^SUBJECT_(\d+)$/.exec(answer.choice);
    const subjectId = match ? Number(match[1]) : NaN;
    if (!subjects.some((subject) => subject.id === subjectId)) throw invalidResponse('과목 분류 결과가 현재 DB 후보와 일치하지 않습니다.');
    return { subjectId, confidence: answer.confidence, probabilities: answer.probabilities, provider: 'BAZE', model: config.decisionModel, modelVersion: response.model_version || response.model || null };
  }
}
