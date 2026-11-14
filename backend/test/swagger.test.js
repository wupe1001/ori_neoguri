import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const swagger = JSON.parse(readFileSync(new URL('../swagger-output.json', import.meta.url), 'utf8'));

const bodyContracts = [
  ['post', '/api/auth/login', 'LoginRequest', ['loginId', 'password']],
  ['post', '/api/notices/', 'NoticeRequest', ['title', 'content']],
  ['post', '/api/questions/{questionId}/improvement/stage-1', 'ImprovementAnswerRequest', ['answer']],
  ['post', '/api/questions/{questionId}/improvement/stage-2', 'ImprovementAnswerRequest', ['answer']],
  ['post', '/api/questions/{questionId}/improvement/final', 'FinalQuestionRequest', ['content']],
  ['post', '/api/questions/{questionId}/subject', 'SubjectSelectionRequest', ['subjectId']],
];

test('Swagger 문서에 모든 JSON 요청 본문과 필수 필드가 포함된다', () => {
  for (const [method, path, definitionName, requiredFields] of bodyContracts) {
    const operation = swagger.paths[path]?.[method];
    assert.ok(operation, `${method.toUpperCase()} ${path}가 없습니다.`);

    const body = operation.parameters?.find((parameter) => parameter.in === 'body');
    assert.ok(body, `${method.toUpperCase()} ${path}의 body가 없습니다.`);
    assert.equal(body.required, true);
    assert.equal(body.schema?.$ref, `#/definitions/${definitionName}`);
    assert.deepEqual(swagger.definitions[definitionName]?.required, requiredFields);
  }
});

test('질문과 교사 답변 업로드 API는 multipart 파일 배열을 문서화한다', () => {
  for (const path of ['/api/questions/', '/api/teacher/questions/{questionId}/answer']) {
    const operation = swagger.paths[path]?.post;
    assert.deepEqual(operation.consumes, ['multipart/form-data']);
    const content = operation.parameters.find((parameter) => parameter.name === 'content');
    const files = operation.parameters.find((parameter) => parameter.name === 'files');
    assert.equal(content.in, 'formData');
    assert.equal(content.required, true);
    assert.equal(files.in, 'formData');
    assert.equal(files.type, 'array');
    assert.equal(files.items.type, 'file');
  }
});

test('Swagger 문서에 목록 쿼리와 양의 정수 경로 인자가 포함된다', () => {
  for (const path of ['/api/notices/', '/api/questions/', '/api/teacher/questions/']) {
    const parameters = swagger.paths[path].get.parameters;
    assert.equal(parameters.find(({ name }) => name === 'page')?.type, 'integer');
    assert.equal(parameters.find(({ name }) => name === 'limit')?.maximum, 100);
  }

  for (const [path, operations] of Object.entries(swagger.paths)) {
    if (!path.includes('{questionId}') && !path.includes('{noticeId}') && !path.includes('{fileId}')) continue;
    for (const operation of Object.values(operations)) {
      const pathParameter = operation.parameters.find(({ in: location }) => location === 'path');
      assert.equal(pathParameter.type, 'integer', path);
      assert.equal(pathParameter.minimum, 1, path);
    }
  }
});

test('Swagger 문서의 모든 엔드포인트에 역할 설명과 기능 태그가 포함된다', () => {
  for (const [path, operations] of Object.entries(swagger.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      assert.ok(operation.summary?.trim(), `${method.toUpperCase()} ${path}의 summary가 없습니다.`);
      assert.ok(operation.description?.trim(), `${method.toUpperCase()} ${path}의 description이 없습니다.`);
      assert.ok(operation.tags?.length, `${method.toUpperCase()} ${path}의 tags가 없습니다.`);
    }
  }
});

test('Swagger Try it out은 문서 서버와 같은 origin을 사용하고 응답을 표시한다', () => {
  assert.equal(swagger.host, undefined);
  assert.equal(swagger.schemes, undefined);

  for (const [path, operations] of Object.entries(swagger.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      assert.ok(Object.keys(operation.responses ?? {}).length, `${method.toUpperCase()} ${path}의 responses가 비어 있습니다.`);
    }
  }
});

test('Swagger 문서에 본문 없는 최종 질문 추천 API가 포함된다', () => {
  const operation = swagger.paths['/api/questions/{questionId}/improvement/final-suggestion']?.post;
  assert.ok(operation);
  assert.equal(operation.parameters.some(({ in: location }) => location === 'body'), false);
  assert.ok(operation.responses['200']);
  assert.ok(operation.responses['409']);
  assert.ok(operation.responses['503']);
});

test('Swagger 문서에 사용자 ID 조회 API와 안전한 응답 필드가 포함된다', () => {
  const operation = swagger.paths['/api/users/{userId}']?.get;
  assert.ok(operation);
  const userId = operation.parameters.find(({ name }) => name === 'userId');
  assert.equal(userId.type, 'integer');
  assert.equal(userId.minimum, 1);
  assert.equal(operation.responses['200'].schema.$ref, '#/definitions/UserResponse');
  assert.deepEqual(swagger.definitions.UserResponse.required, ['id', 'loginId', 'nickname', 'role', 'createdAt']);
  assert.equal(swagger.definitions.UserResponse.properties.password, undefined);
});
