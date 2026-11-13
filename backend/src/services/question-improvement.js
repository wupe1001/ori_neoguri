import { ModelError, conflict } from '../errors.js';
import { BazeGenerationModel } from '../model-clients/baze-openai.js';
import { store } from '../repositories/store.js';

export const IMPROVEMENT_STAGES = Object.freeze({
  STAGE_1: 'IMPROVEMENT_STAGE_1_GENERATION',
  STAGE_2: 'IMPROVEMENT_STAGE_2_GENERATION',
  STAGE_3: 'IMPROVEMENT_STAGE_3_GENERATION',
  FINAL_SUGGESTION: 'FINAL_QUESTION_SUGGESTION_GENERATION',
});

const generatingStatus = {
  [IMPROVEMENT_STAGES.STAGE_1]: 'GENERATING_IMPROVEMENT_STAGE_1',
  [IMPROVEMENT_STAGES.STAGE_2]: 'GENERATING_IMPROVEMENT_STAGE_2',
  [IMPROVEMENT_STAGES.STAGE_3]: 'GENERATING_IMPROVEMENT_STAGE_3',
  [IMPROVEMENT_STAGES.FINAL_SUGGESTION]: 'GENERATING_FINAL_QUESTION_SUGGESTION',
};

export class QuestionImprovementService {
  constructor(generationModel = new BazeGenerationModel()) {
    this.generation = generationModel;
  }

  fail(questionId, stage, error) {
    store.updateQuestion(questionId, {
      status: 'PROCESSING_FAILED', failed_stage: stage, retry_status: generatingStatus[stage],
    });
    if (error instanceof ModelError) {
      error.details = { ...error.details, questionId, failedStage: stage, retryable: error.retryable };
    }
    throw error;
  }

  history(questionId) {
    const question = store.getQuestion(questionId);
    const improvement = store.getImprovement(questionId);
    return { originalQuestion: question.original_content, improvement };
  }

  async generateStage1(questionId) {
    store.ensureImprovement(questionId);
    try {
      const question = store.getQuestion(questionId);
      const result = await this.generation.generateImprovementStage1(question.original_content);
      if (!store.saveImprovementStage1(questionId, result)) {
        throw conflict('QUESTION_INVALID_STATE', '질문 개선 1단계 생성 중 상태가 변경되었습니다.');
      }
      return { questionId, status: 'AWAITING_IMPROVEMENT_STAGE_1', prompt: result.prompt, exampleAnswers: result.exampleAnswers };
    } catch (error) {
      if (error instanceof ModelError) this.fail(questionId, IMPROVEMENT_STAGES.STAGE_1, error);
      throw error;
    }
  }

  async generateStage2(questionId) {
    try {
      const result = await this.generation.generateImprovementStage2(this.history(questionId));
      if (!store.saveImprovementStage2(questionId, result)) {
        throw conflict('QUESTION_INVALID_STATE', '질문 개선 2단계 생성 중 상태가 변경되었습니다.');
      }
      return { questionId, status: 'AWAITING_IMPROVEMENT_STAGE_2', prompt: result.prompt };
    } catch (error) {
      if (error instanceof ModelError) this.fail(questionId, IMPROVEMENT_STAGES.STAGE_2, error);
      throw error;
    }
  }

  async generateStage3(questionId) {
    try {
      const result = await this.generation.generateImprovementStage3(this.history(questionId));
      const candidates = store.saveImprovementStage3(questionId, result);
      if (!candidates) throw conflict('QUESTION_INVALID_STATE', '질문 개선 3단계 생성 중 상태가 변경되었습니다.');
      return { questionId, status: 'AWAITING_FINAL_QUESTION', prompt: result.prompt, candidates };
    } catch (error) {
      if (error instanceof ModelError) this.fail(questionId, IMPROVEMENT_STAGES.STAGE_3, error);
      throw error;
    }
  }

  async requestFinalSuggestion(questionId) {
    const started = store.beginFinalQuestionSuggestion(questionId);
    if (started.kind === 'CACHED') {
      return { questionId, status: 'AWAITING_FINAL_QUESTION', suggestedQuestion: started.suggestedQuestion };
    }
    if (started.kind !== 'STARTED') {
      throw conflict('QUESTION_INVALID_STATE', '현재 질문 상태에서는 최종 질문 추천을 생성할 수 없습니다.');
    }
    return this.generateFinalSuggestion(questionId);
  }

  async generateFinalSuggestion(questionId) {
    try {
      const result = await this.generation.generateFinalQuestionSuggestion(this.history(questionId));
      if (!store.saveFinalQuestionSuggestion(questionId, result.suggestedQuestion)) {
        throw conflict('QUESTION_INVALID_STATE', '최종 질문 추천 생성 중 상태가 변경되었습니다.');
      }
      return { questionId, status: 'AWAITING_FINAL_QUESTION', suggestedQuestion: result.suggestedQuestion };
    } catch (error) {
      if (error instanceof ModelError) this.fail(questionId, IMPROVEMENT_STAGES.FINAL_SUGGESTION, error);
      throw error;
    }
  }
}

export const questionImprovement = new QuestionImprovementService();
