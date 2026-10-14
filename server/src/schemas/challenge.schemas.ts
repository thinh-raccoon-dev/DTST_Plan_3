import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.js';

const questionInputSchema = z
  .object({
    prompt: z.string().trim().min(5, 'Câu hỏi cần ít nhất 5 ký tự.').max(500),
    options: z
      .array(z.string().trim().min(1, 'Lựa chọn không được để trống.').max(200))
      .min(2, 'Cần ít nhất 2 lựa chọn.')
      .max(6, 'Tối đa 6 lựa chọn.'),
    correctOptionIndex: z.number().int().min(0),
    explanation: z.string().trim().max(600).optional(),
  })
  .strict()
  .refine((q) => q.correctOptionIndex < q.options.length, {
    message: 'Đáp án đúng phải là một trong các lựa chọn.',
    path: ['correctOptionIndex'],
  });

const challengeFields = z
  .object({
    destinationId: objectIdSchema,
    title: z.string().trim().min(3, 'Tên thử thách cần ít nhất 3 ký tự.').max(160),
    description: z.string().trim().max(1000).default(''),
    story: z.string().trim().max(4000).default(''),
    questions: z.array(questionInputSchema).min(1, 'Cần ít nhất 1 câu hỏi.').max(20),
    scoringRules: z
      .object({
        rewardPoints: z.number().int('Điểm thưởng phải là số nguyên.').min(0).max(1000),
        minCorrect: z.number().int().min(1),
      })
      .strict(),
    status: z.enum(['active', 'inactive']).default('inactive'),
  })
  .strict();

export const challengeInputSchema = challengeFields.refine(
  (value) => value.scoringRules.minCorrect <= value.questions.length,
  { message: 'Số câu đúng tối thiểu không được lớn hơn số câu hỏi.', path: ['scoringRules', 'minCorrect'] },
);
export type ChallengeInput = z.infer<typeof challengeInputSchema>;

export const challengeStatusSchema = z.object({ status: z.enum(['active', 'inactive']) }).strict();

export const adminChallengeQuerySchema = paginationSchema.extend({
  destinationId: objectIdSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const completeChallengeSchema = z
  .object({
    qrCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/, 'Mã QR không hợp lệ.'),
    answers: z
      .array(z.object({ questionId: objectIdSchema, optionIndex: z.number().int().min(0).max(5) }).strict())
      .min(1)
      .max(20),
  })
  .strict();
export type CompleteChallengeInput = z.infer<typeof completeChallengeSchema>;
