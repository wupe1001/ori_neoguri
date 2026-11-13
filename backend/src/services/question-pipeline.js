import { config } from '../config.js';
import { ModelError, conflict } from '../errors.js';
import { BazeDecisionModel } from '../model-clients/baze-decisions.js';
import { BazeGenerationModel } from '../model-clients/baze-openai.js';
import { store } from '../repositories/store.js';

export const STAGES = Object.freeze({
  CRISIS: 'CRISIS_DETECTION', NOTICE: 'NOTICE_MATCHING', NOTICE_ANSWER: 'NOTICE_ANSWER_GENERATION',
  SUFFICIENCY: 'SUFFICIENCY_CHECK', REWRITE: 'QUESTION_REWRITE', SUBJECT: 'SUBJECT_CLASSIFICATION',
});

const crisisMessage = '질문 내용에서 고민 또는 위기 신호가 확인되어 담임 선생님께 전달했습니다. 담임 선생님의 답변을 기다려 주세요.';

export class QuestionPipeline {
  constructor(decisionModel = new BazeDecisionModel(), generationModel = new BazeGenerationModel()) {
    this.decision = decisionModel;
    this.generation = generationModel;
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
          return { questionId, status: 'ASSIGNED', routeType: 'HOMEROOM', message: crisisMessage };
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

      if (stageIndex <= 3) {
        currentStage = STAGES.SUFFICIENCY;
        const result = await this.decision.checkSufficiency(content);
        store.logDecision(questionId, STAGES.SUFFICIENCY, result);
        if (result.probability < config.thresholds.sufficiency) {
          store.updateQuestion(questionId, { status: 'NEEDS_DETAILS', failed_stage: null, retry_status: null });
          return { questionId, status: 'NEEDS_DETAILS', requiredFields: ['who', 'when', 'where', 'what', 'how', 'why'] };
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
      store.assignSubject(questionId, subject);
      return { questionId, status: 'ASSIGNED', routeType: 'SUBJECT', subject: { id: subject.id, name: subject.name } };
    } catch (error) {
      if (error instanceof ModelError) this.fail(questionId, currentStage, 'PROCESSING', error);
      throw error;
    }
  }

  async rewrite(questionId) {
    const question = store.getQuestion(questionId);
    const details = store.getDetails(questionId);
    try {
      const rewritten = await this.generation.rewriteQuestion(question.original_content, details);
      const changed = store.updateQuestion(questionId, { status: 'AWAITING_CONFIRMATION', rewritten_content: rewritten, failed_stage: null, retry_status: null }, 'REWRITING');
      if (!changed) throw conflict('QUESTION_INVALID_STATE', '질문 재작성 중 상태가 변경되었습니다.');
      return { questionId, status: 'AWAITING_CONFIRMATION', rewrittenContent: rewritten };
    } catch (error) {
      if (error instanceof ModelError) this.fail(questionId, STAGES.REWRITE, 'REWRITING', error);
      throw error;
    }
  }

  async retry(questionId) {
    const question = store.getQuestion(questionId);
    if (question.failed_stage === STAGES.REWRITE) {
      const changed = store.updateQuestion(questionId, { status: 'REWRITING' }, 'PROCESSING_FAILED');
      if (!changed) throw conflict('QUESTION_INVALID_STATE', '질문 상태가 이미 변경되었습니다.');
      return this.rewrite(questionId);
    }
    const changed = store.updateQuestion(questionId, { status: 'PROCESSING' }, 'PROCESSING_FAILED');
    if (!changed) throw conflict('QUESTION_INVALID_STATE', '질문 상태가 이미 변경되었습니다.');
    return this.run(questionId, question.failed_stage);
  }
}

export const questionPipeline = new QuestionPipeline();
