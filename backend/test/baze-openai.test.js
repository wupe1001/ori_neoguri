import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SESSION_SECRET ||= 'test-secret';
process.env.BAZE_API_KEY ||= 'test-api-key';
process.env.GENERATION_MODEL ||= 'test-model';
process.env.MODEL_TIMEOUT_MS ||= '1000';
process.env.CRISIS_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.NOTICE_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SUFFICIENCY_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.SUBJECT_CONFIDENCE_THRESHOLD ||= '0.8';
process.env.UNIT_CONFIDENCE_THRESHOLD ||= '0.8';

const { BazeGenerationModel, finalQuestionSuggestionSchema, parseGenerationResponse } = await import('../src/model-clients/baze-openai.js');
const { ModelError } = await import('../src/errors.js');
const { z } = await import('zod');

const schema = z.object({ answer: z.string().trim().min(1) }).strict();

function responseWith(text, overrides = {}) {
  return {
    id: 'resp_abc123',
    object: 'response',
    status: 'completed',
    output: [{
      type: 'message',
      id: 'msg_abc',
      role: 'assistant',
      content: [{ type: 'output_text', text }],
    }],
    usage: {
      input_tokens: 25,
      output_tokens: 30,
      output_tokens_details: { reasoning_tokens: 512 },
    },
    ...overrides,
  };
}

test('Responses API의 일반 output_text를 단일 결과 필드로 변환한다', () => {
  const result = parseGenerationResponse(responseWith('The answer is 42.'), schema, 'answer');
  assert.deepEqual(result, { answer: 'The answer is 42.' });
});

test('Responses API의 JSON output_text를 구조화 결과로 파싱한다', () => {
  const result = parseGenerationResponse(responseWith('{"answer":"정답은 42입니다."}'), schema, 'answer');
  assert.deepEqual(result, { answer: '정답은 42입니다.' });
});

test('SDK가 만든 output_parsed도 스키마 검증 후 사용한다', () => {
  const result = parseGenerationResponse(
    responseWith('ignored', { output_parsed: { answer: '파싱된 답변' } }),
    schema,
    'answer',
  );
  assert.deepEqual(result, { answer: '파싱된 답변' });
});

test('완료되지 않은 응답을 거부한다', () => {
  assert.throws(
    () => parseGenerationResponse(responseWith('', { status: 'incomplete' }), schema, 'answer'),
    (error) => error instanceof ModelError && error.code === 'MODEL_INVALID_RESPONSE',
  );
});

test('refusal 응답을 거부한다', () => {
  const response = responseWith('');
  response.output[0].content = [{ type: 'refusal', refusal: 'cannot comply' }];
  assert.throws(
    () => parseGenerationResponse(response, schema, 'answer'),
    (error) => error instanceof ModelError && error.code === 'MODEL_INVALID_RESPONSE',
  );
});

test('생성 모델이 Responses API 원본 응답에서 답변을 반환한다', async () => {
  let request;
  const model = new BazeGenerationModel({
    responses: {
      create: async (params) => {
        request = params;
        return responseWith('공지에 따른 답변입니다.');
      },
    },
  });

  const answer = await model.answerFromNotices('질문', [{ id: 1, title: '공지', content: '내용' }]);

  assert.equal(answer, '공지에 따른 답변입니다.');
  assert.equal(request.model, 'test-model');
  assert.equal(request.text.format.type, 'json_schema');
});

test('최종 질문 추천은 엄격한 단일 문자열 결과만 허용한다', () => {
  const result = parseGenerationResponse(
    responseWith('{"suggestedQuestion":"현재완료와 과거시제의 차이를 알려 주세요."}'),
    finalQuestionSuggestionSchema,
    'suggestedQuestion',
  );
  assert.deepEqual(result, { suggestedQuestion: '현재완료와 과거시제의 차이를 알려 주세요.' });

  assert.throws(
    () => parseGenerationResponse(
      responseWith('{"suggestedQuestion":"질문","extra":true}'),
      finalQuestionSuggestionSchema,
      'suggestedQuestion',
    ),
    (error) => error instanceof ModelError && error.code === 'MODEL_INVALID_RESPONSE',
  );
});
