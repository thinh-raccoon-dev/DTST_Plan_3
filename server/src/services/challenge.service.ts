import type { Types } from 'mongoose';
import type { Challenge } from '../models/Challenge.js';
import { badRequest } from '../utils/errors.js';

export type LeanChallenge = Challenge & {
  _id: Types.ObjectId;
  questions: Array<Challenge['questions'][number] & { _id: Types.ObjectId }>;
};

/** Public payload: the correct answers are intentionally absent. */
export function toPublicChallenge(challenge: LeanChallenge) {
  return {
    id: String(challenge._id),
    destinationId: String(challenge.destinationId),
    title: challenge.title,
    description: challenge.description ?? '',
    story: challenge.story ?? '',
    type: challenge.type,
    rewardPoints: challenge.scoringRules.rewardPoints,
    minCorrect: challenge.scoringRules.minCorrect,
    questionCount: challenge.questions.length,
    questions: challenge.questions.map((question) => ({
      id: String(question._id),
      prompt: question.prompt,
      options: [...question.options],
    })),
  };
}

export function toChallengeSummary(challenge: LeanChallenge) {
  const { questions: _questions, ...rest } = toPublicChallenge(challenge);
  return rest;
}

export interface GradeResult {
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  results: Array<{ questionId: string; correct: boolean; correctOptionIndex?: number; explanation?: string }>;
}

/**
 * Every question must be answered exactly once. Correct answers and explanations are revealed
 * only after a passing attempt so failed attempts cannot be used to harvest answers.
 */
export function gradeAnswers(
  challenge: LeanChallenge,
  answers: Array<{ questionId: string; optionIndex: number }>,
): GradeResult {
  const byQuestion = new Map<string, number>();
  for (const answer of answers) {
    if (byQuestion.has(answer.questionId)) throw badRequest('Mỗi câu hỏi chỉ được trả lời một lần.', 'DUPLICATE_ANSWER');
    byQuestion.set(answer.questionId, answer.optionIndex);
  }

  const questionIds = new Set(challenge.questions.map((q) => String(q._id)));
  for (const questionId of byQuestion.keys()) {
    if (!questionIds.has(questionId)) throw badRequest('Câu trả lời không khớp với thử thách.', 'UNKNOWN_QUESTION');
  }
  if (byQuestion.size !== challenge.questions.length) {
    throw badRequest('Vui lòng trả lời tất cả câu hỏi.', 'INCOMPLETE_ANSWERS');
  }

  const graded = challenge.questions.map((question) => {
    const chosen = byQuestion.get(String(question._id));
    return { question, correct: chosen === question.correctOptionIndex };
  });
  const correctCount = graded.filter((g) => g.correct).length;
  const passed = correctCount >= challenge.scoringRules.minCorrect;

  return {
    correctCount,
    totalQuestions: challenge.questions.length,
    passed,
    results: graded.map(({ question, correct }) => ({
      questionId: String(question._id),
      correct,
      ...(passed
        ? { correctOptionIndex: question.correctOptionIndex, explanation: question.explanation ?? undefined }
        : {}),
    })),
  };
}
