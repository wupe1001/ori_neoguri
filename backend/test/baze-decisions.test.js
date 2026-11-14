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

const { BazeDecisionModel, parseJevResponse } = await import('../src/model-clients/baze-decisions.js');
const { ModelError } = await import('../src/errors.js');

function jevResponse(overrides = {}) {
  return {
    id: 'decisions-7f9dfaa79a474af7870eadf6756d0434',
    object: 'decisions',
    model: 'jev-1.13.0',
    answers: { is_crisis: { type: 'noul', noul: 0.01 } },
    usage: { input_tokens: 326, output_tokens: 22 },
    ...overrides,
  };
}

test('Jev decisions 응답 형식을 파싱한다', () => {
  const result = parseJevResponse(jevResponse(), ['is_crisis']);

  assert.equal(result.id, 'decisions-7f9dfaa79a474af7870eadf6756d0434');
  assert.equal(result.object, 'decisions');
  assert.equal(result.model, 'jev-1.13.0');
  assert.deepEqual(result.answers.is_crisis, { type: 'noul', noul: 0.01 });
  assert.deepEqual(result.usage, { input_tokens: 326, output_tokens: 22 });
});

test('파싱된 Jev noul 응답을 애플리케이션 결과로 정규화한다', () => {
  const parsed = parseJevResponse(jevResponse(), ['is_crisis']);
  const result = new BazeDecisionModel().normalizeNoul(parsed, 'is_crisis');

  assert.equal(result.value, false);
  assert.equal(result.probability, 0.01);
  assert.equal(result.confidence, 0.99);
  assert.equal(result.modelVersion, 'jev-1.13.0');
});

test('요청과 다른 answer 키를 거부한다', () => {
  assert.throws(
    () => parseJevResponse(jevResponse(), ['is_sufficient']),
    (error) => error instanceof ModelError
      && error.code === 'MODEL_INVALID_RESPONSE'
      && error.details.expected[0] === 'is_sufficient',
  );
});

test('0~1 범위를 벗어난 noul 값을 거부한다', () => {
  const response = jevResponse({ answers: { is_crisis: { type: 'noul', noul: 1.01 } } });
  assert.throws(
    () => parseJevResponse(response, ['is_crisis']),
    (error) => error instanceof ModelError && error.code === 'MODEL_INVALID_RESPONSE',
  );
});

test('잘못된 object 타입과 토큰 사용량을 거부한다', () => {
  const response = jevResponse({
    object: 'response',
    usage: { input_tokens: -1, output_tokens: 22 },
  });
  assert.throws(
    () => parseJevResponse(response, ['is_crisis']),
    (error) => error instanceof ModelError && error.code === 'MODEL_INVALID_RESPONSE',
  );
});

test('Jev choice 응답 형식을 파싱한다', () => {
  const response = jevResponse({
    answers: {
      subject: {
        type: 'choice',
        choice: 'SUBJECT_2',
        confidence: 0.9,
        probabilities: { SUBJECT_1: 0.1, SUBJECT_2: 0.9 },
      },
    },
  });

  const result = parseJevResponse(response, ['subject']);
  assert.equal(result.answers.subject.choice, 'SUBJECT_2');
});

test('선택된 과목의 단원 후보만 UNIT 키로 분류한다', async () => {
  let state;
  let questions;
  const model = new BazeDecisionModel();
  model.request = async (requestState, requestQuestions) => {
    state = requestState;
    questions = requestQuestions;
    return jevResponse({
      answers: {
        unit: {
          type: 'choice', choice: 'UNIT_12', confidence: 0.91,
          probabilities: { UNIT_11: 0.09, UNIT_12: 0.91 },
        },
      },
    });
  };
  const subject = { id: 3, name: '영어' };
  const units = [
    { id: 11, subjectId: 3, name: '독해' },
    { id: 12, subjectId: 3, name: '문법' },
  ];

  const result = await model.classifyUnit('현재완료가 궁금해요.', subject, units);

  assert.equal(result.unitId, 12);
  assert.equal(result.confidence, 0.91);
  assert.deepEqual(state.subject, subject);
  assert.deepEqual(questions.unit.criteria, { UNIT_11: '독해', UNIT_12: '문법' });
});

test('다른 과목에 속한 단원 후보를 거부한다', async () => {
  const model = new BazeDecisionModel();
  await assert.rejects(
    model.classifyUnit('질문', { id: 1, name: '수학' }, [{ id: 1, subjectId: 2, name: '독서' }]),
    (error) => error instanceof ModelError && error.code === 'MODEL_INVALID_RESPONSE',
  );
});
