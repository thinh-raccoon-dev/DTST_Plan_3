import clsx from 'clsx';
import { CheckCircle2, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { useState } from 'react';
import { api, toApiError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import type { BadgeInfo, CompletionResult, PublicChallenge } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Notice } from '../ui/States';

export function announceBadges(badges: BadgeInfo[]) {
  for (const badge of badges) toast.success(`Huy hiệu mới: ${badge.name}`, badge.description);
}

export function ChallengeQuiz({
  challenge,
  qrCode,
  completed,
  disabled,
  onCompleted,
}: {
  challenge: PublicChallenge;
  qrCode: string;
  completed: boolean;
  disabled?: boolean;
  onCompleted: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allAnswered = challenge.questions.every((q) => answers[q.id] !== undefined);

  const submit = async () => {
    if (!allAnswered) {
      setError('Vui lòng trả lời tất cả câu hỏi trước khi gửi.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<CompletionResult>(`/challenges/${challenge.id}/complete`, {
        qrCode,
        answers: Object.entries(answers).map(([questionId, optionIndex]) => ({ questionId, optionIndex })),
      });
      setResult(res.data);
      if (res.data.passed && !res.data.alreadyCompleted) {
        toast.success(`Hoàn thành thử thách! +${res.data.pointsAwarded} điểm`);
        announceBadges(res.data.newBadges);
      }
      if (res.data.passed) onCompleted();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const resultFor = (questionId: string) => result?.results.find((r) => r.questionId === questionId);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg">
            <Trophy className="size-5 text-teal-500" aria-hidden />
            {challenge.title}
          </h3>
          {challenge.description && <p className="mt-1 text-sm text-river-600">{challenge.description}</p>}
        </div>
        <Badge tone={completed ? 'leaf' : 'teal'}>{completed ? 'Đã hoàn thành' : `+${challenge.rewardPoints} điểm`}</Badge>
      </div>
      {challenge.story && <p className="mt-4 rounded-card bg-sand-100 p-4 text-sm leading-relaxed text-river-800">{challenge.story}</p>}

      <form
        className="mt-5 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {challenge.questions.map((question, qIndex) => {
          const graded = resultFor(question.id);
          return (
            <fieldset key={question.id} disabled={disabled || submitting || result?.passed}>
              <legend className="text-sm font-semibold text-river-900">
                Câu {qIndex + 1}. {question.prompt}
              </legend>
              <div className="mt-2 grid gap-2">
                {question.options.map((option, optionIndex) => {
                  const selected = answers[question.id] === optionIndex;
                  const isCorrectAnswer = graded?.correctOptionIndex === optionIndex;
                  return (
                    <label
                      key={optionIndex}
                      className={clsx(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-sm transition-colors',
                        isCorrectAnswer
                          ? 'border-leaf-500 bg-leaf-50'
                          : selected
                            ? 'border-leaf-500 bg-white ring-2 ring-leaf-100'
                            : 'border-sand-300 bg-white hover:border-leaf-300',
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${challenge.id}-${question.id}`}
                        className="size-4 accent-leaf-600"
                        checked={selected}
                        onChange={() => {
                          setAnswers((a) => ({ ...a, [question.id]: optionIndex }));
                          if (result && !result.passed) setResult(null);
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
              {graded && (
                <p className={clsx('mt-2 inline-flex items-center gap-1.5 text-sm font-medium', graded.correct ? 'text-leaf-700' : 'text-red-700')}>
                  {graded.correct ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
                  {graded.correct ? 'Chính xác' : 'Chưa đúng'}
                  {graded.explanation && <span className="font-normal text-river-600"> — {graded.explanation}</span>}
                </p>
              )}
            </fieldset>
          );
        })}

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {result && (
          <div aria-live="polite">
            {result.passed ? (
              <Notice tone="success" title={result.alreadyCompleted ? 'Bạn đã hoàn thành thử thách này trước đó' : `Hoàn thành! +${result.pointsAwarded} điểm`}>
                Đúng {result.correctCount}/{result.totalQuestions} câu.{' '}
                {result.alreadyCompleted
                  ? 'Mỗi thử thách chỉ nhận thưởng một lần nên lần này không cộng thêm điểm.'
                  : result.savedTo === 'device'
                    ? 'Kết quả đang được lưu cho trình duyệt này. Đăng nhập và đồng bộ để giữ vào tài khoản.'
                    : 'Kết quả đã được ghi vào hộ chiếu của bạn.'}
              </Notice>
            ) : (
              <Notice tone="warning" title="Chưa đạt">
                Bạn đúng {result.correctCount}/{result.totalQuestions} câu, cần ít nhất {result.minCorrect} câu. Hãy đọc lại câu chuyện và thử lại.
              </Notice>
            )}
          </div>
        )}

        {!result?.passed && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="accent" loading={submitting} disabled={disabled}>
              Gửi đáp án
            </Button>
            {result && (
              <Button
                variant="ghost"
                onClick={() => {
                  setAnswers({});
                  setResult(null);
                }}
                icon={<RotateCcw className="size-4" aria-hidden />}
              >
                Làm lại
              </Button>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}
