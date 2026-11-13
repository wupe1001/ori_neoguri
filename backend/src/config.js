import path from 'node:path';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`필수 환경 변수 ${name}이(가) 설정되지 않았습니다.`);
  return value;
}

function numberSetting(name, { min = 0, max = Number.POSITIVE_INFINITY, integer = false } = {}) {
  const raw = required(name);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${name}은(는) ${min} 이상 ${max} 이하의 ${integer ? '정수' : '숫자'}여야 합니다.`);
  }
  return value;
}

const cwd = process.cwd();

export const config = Object.freeze({
  port: Number(process.env.PORT || 3000),
  sessionSecret: required('SESSION_SECRET'),
  sqlitePath: path.resolve(cwd, process.env.SQLITE_PATH || './data/app.sqlite'),
  seedPath: path.resolve(cwd, process.env.SEED_PATH || './db/seed.json'),
  bazeApiKey: required('BAZE_API_KEY'),
  bazeBaseUrl: (process.env.BAZE_BASE_URL || 'https://api.baze.co/v1/gateway').replace(/\/$/, ''),
  bazeUserAgent: process.env.BAZE_USER_AGENT?.trim() || 'ori-neoguri-backend/1.0',
  decisionModel: process.env.DECISION_MODEL?.trim() || 'jev-latest',
  generationModel: required('GENERATION_MODEL'),
  modelTimeoutMs: numberSetting('MODEL_TIMEOUT_MS', { min: 1, integer: true }),
  thresholds: Object.freeze({
    crisis: numberSetting('CRISIS_CONFIDENCE_THRESHOLD', { min: 0, max: 1 }),
    notice: numberSetting('NOTICE_CONFIDENCE_THRESHOLD', { min: 0, max: 1 }),
    sufficiency: numberSetting('SUFFICIENCY_CONFIDENCE_THRESHOLD', { min: 0, max: 1 }),
    subject: numberSetting('SUBJECT_CONFIDENCE_THRESHOLD', { min: 0, max: 1 }),
  }),
});
