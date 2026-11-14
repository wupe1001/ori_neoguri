import { config } from '../config.js';
import { ModelError, conflict } from '../errors.js';
import { BazeDecisionModel } from '../model-clients/baze-decisions.js';
import { BazeGenerationModel } from '../model-clients/baze-openai.js';
import { store } from '../repositories/store.js';
import { IMPROVEMENT_STAGES, QuestionImprovementService } from './question-improvement.js';

export const STAGES = Object.freeze({
  CRISIS: 'CRISIS_DETECTION', NOTICE: 'NOTICE_MATCHING', NOTICE_ANSWER: 'NOTICE_ANSWER_GENERATION',
  SUFFICIENCY: 'SUFFICIENCY_CHECK', SUBJECT: 'SUBJECT_CLASSIFICATION',
  UNIT: 'UNIT_CLASSIFICATION',
  IMPROVEMENT_1: IMPROVEMENT_STAGES.STAGE_1,
  IMPROVEMENT_2: IMPROVEMENT_STAGES.STAGE_2,
  IMPROVEMENT_3: IMPROVEMENT_STAGES.STAGE_3,
  FINAL_SUGGESTION: IMPROVEMENT_STAGES.FINAL_SUGGESTION,
});

const crisisMessage = '질문 내용에서 고민 또는 위기 신호가 확인되어 담임 선생님께 전달했습니다. 담임 선생님의 답변을 기다려 주세요.';

export class QuestionPipeline {
  constructor(decisionModel = new BazeDecisionModel(), generationModel = new BazeGenerationModel()) {
    this.decision = decisionModel;
    this.generation = generationModel;
    this.improvement = new QuestionImprovementService(generationModel);
  }

  fail(questionId, stage, retryStatus, error) {
    store.updateQuestion(questionId, { status: 'PROCESSING_FAILED', failed_stage: stage, retry_status: retryStatus });
    if (error instanceof ModelError) {
      error.details = { ...error.details, questionId, failedStage: stage, retryable: error.retryable };
      throw error;
    }
    throw error;
  }

  async run(questionId, startStage = STAGES.CRISIS) {
    const question = store.getQuestion(questionId);
    const content = question.final_content || question.original_content;
    const order = [STAGES.CRISIS, STAGES.NOTICE, STAGES.NOTICE_ANSWER, STAGES.SUFFICIENCY, STAGES.SUBJECT];
    let stageIndex = order.indexOf(startStage);
    if (stageIndex < 0) stageIndex = 0;
    let currentStage = startStage;
    try {
      if (stageIndex <= 0) {
        currentStage = STAGES.CRISIS;
        const result = await this.decision.detectCrisis(content);
        store.logDecision(questionId, STAGES.CRISIS, result);
        if (result.probability >= config.thresholds.crisis || result.confidence < config.thresholds.crisis) {
          store.assignHomeroom(question);
          return { questionId, status: 'ASSIGNED', routeType: 'HOMEROOM', unit: null, message: crisisMessage };
        }
      }

      let noticeMatch;
      if (stageIndex <= 1) {
        currentStage = STAGES.NOTICE;
        const notices = store.listAllNotices();
        noticeMatch = await this.decision.matchNotices(content, notices);
        store.logDecision(questionId, STAGES.NOTICE, noticeMatch);
      } else {
        noticeMatch = store.getLatestDecision(questionId, STAGES.NOTICE);
      }

      if (noticeMatch?.answerable) {
        currentStage = STAGES.NOTICE_ANSWER;
        const selected = noticeMatch.noticeIds.map((id) => store.getNotice(id)).filter(Boolean);
        const answerContent = await this.generation.answerFromNotices(content, selected);
        store.createNoticeAnswer(questionId, answerContent, noticeMatch.noticeIds);
        return { questionId, status: 'NOTICE_ANSWERED', answer: { content: answerContent, sources: selected.map(({ id, title }) => ({ id, title })) } };
      }

      if (startStage === STAGES.NOTICE_ANSWER && !noticeMatch?.answerable) throw new ModelError('MODEL_INVALID_RESPONSE', '재시도에 필요한 공지 판단 결과가 없습니다.', { retryable: true });

      const completedImprovement = Boolean(store.getImprovementRecord(questionId)?.completedAt);
      if (stageIndex <= 3 && !completedImprovement) {
        currentStage = STAGES.SUFFICIENCY;
        const result = await this.decision.checkSufficiency(content);
        store.logDecision(questionId, STAGES.SUFFICIENCY, result);
        if (result.probability < config.thresholds.sufficiency) {
          if (!store.startImprovement(questionId)) throw conflict('QUESTION_INVALID_STATE', '질문 개선 시작 중 상태가 변경되었습니다.');
          return this.improvement.generateStage1(questionId);
        }
      }

      const subjects = store.listSubjects();
      currentStage = STAGES.SUBJECT;
      const classification = await this.decision.classifySubject(content, subjects);
      store.logDecision(questionId, STAGES.SUBJECT, classification);
      if (classification.confidence < config.thresholds.subject) {
        store.updateQuestion(questionId, { status: 'NEEDS_SUBJECT_SELECTION', failed_stage: null, retry_status: null });
        return { questionId, status: 'NEEDS_SUBJECT_SELECTION', subjects: subjects.map(({ id, name }) => ({ id, name })) };
      }
      const subject = subjects.find((item) => item.id === classification.subjectId);
      const unit = await this.classifyUnit(questionId, content, subject);
      if (!store.assignSubject(questionId, subject, unit)) throw conflict('QUESTION_INVALID_STATE', '질문 상태가 이미 변경되었습니다.');
      return { questionId, status: 'ASSIGNED', routeType: 'SUBJECT', subject: { id: subject.id, name: subject.name }, unit: unit ? { id: unit.id, name: unit.name } : null };
    } catch (error) {
      if (error instanceof ModelError) this.fail(questionId, currentStage, 'PROCESSING', error);
      throw error;
    }
  }

  async classifyUnit(questionId, content, subject) {
    const units = store.listSubjectUnits(subject.id);
    try {
      const classification = await this.decision.classifyUnit(content, subject, units);
      store.logDecision(questionId, STAGES.UNIT, classification);
      if (classification.confidence < config.thresholds.unit) return null;
      return units.find((item) => item.id === classification.unitId) || null;
    } catch (error) {
      if (error instanceof ModelError) return null;
      throw error;
    }
  }

  async assignSelectedSubject(questionId, subject) {
    const question = store.getQuestion(questionId);
    const content = question.final_content || question.original_content;
    const unit = await this.classifyUnit(questionId, content, subject);
    const changed = store.selectSubject(questionId, subject, unit);
    if (!changed) return null;
    return { questionId, status: 'ASSIGNED', routeType: 'SUBJECT', subject: { id: subject.id, name: subject.name }, unit: unit ? { id: unit.id, name: unit.name } : null };
  }

  async retry(questionId) {
    const question = store.getQuestion(questionId);
    const improvementRetry = {
      [STAGES.IMPROVEMENT_1]: ['GENERATING_IMPROVEMENT_STAGE_1', () => this.improvement.generateStage1(questionId)],
      [STAGES.IMPROVEMENT_2]: ['GENERATING_IMPROVEMENT_STAGE_2', () => this.improvement.generateStage2(questionId)],
      [STAGES.IMPROVEMENT_3]: ['GENERATING_IMPROVEMENT_STAGE_3', () => this.improvement.generateStage3(questionId)],
      [STAGES.FINAL_SUGGESTION]: ['GENERATING_FINAL_QUESTION_SUGGESTION', () => this.improvement.generateFinalSuggestion(questionId)],
    }[question.failed_stage];
    if (improvementRetry) {
      const [status, resume] = improvementRetry;
      const changed = store.updateQuestion(questionId, { status }, 'PROCESSING_FAILED');
      if (!changed) throw conflict('QUESTION_INVALID_STATE', '질문 상태가 이미 변경되었습니다.');
      return resume();
    }
    const changed = store.updateQuestion(questionId, { status: 'PROCESSING' }, 'PROCESSING_FAILED');
    if (!changed) throw conflict('QUESTION_INVALID_STATE', '질문 상태가 이미 변경되었습니다.');
    return this.run(questionId, question.failed_stage);
  }
}

export const questionPipeline = new QuestionPipeline();
