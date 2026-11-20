import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, toApiError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import type { PartnerChallengeQuestion } from '../../types/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import { Modal } from '../ui/Modal';

export interface EditablePartnerChallenge {
  id: string;
  title: string;
  description?: string;
  story?: string;
  rewardPoints: number;
  status: string;
  questions?: PartnerChallengeQuestion[];
}

interface PartnerChallengeModalProps {
  open: boolean;
  destinationId: string;
  destinationName: string;
  editingChallenge: EditablePartnerChallenge | null;
  onClose: () => void;
  onSaved: () => void;
}

interface QuestionDraft {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

function emptyQuestion(): QuestionDraft {
  return {
    prompt: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    explanation: '',
  };
}

export function PartnerChallengeModal({
  open,
  destinationId,
  destinationName,
  editingChallenge,
  onClose,
  onSaved,
}: PartnerChallengeModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [story, setStory] = useState('');
  const [rewardPoints, setRewardPoints] = useState(50);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(3);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiDraftSource, setAiDraftSource] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAiDraftSource(null);
    setAiTopic('');
    if (editingChallenge) {
      setTitle(editingChallenge.title || '');
      setDescription(editingChallenge.description || '');
      setStory(editingChallenge.story || '');
      setRewardPoints(editingChallenge.rewardPoints || 50);
      const mapped =
        editingChallenge.questions && editingChallenge.questions.length > 0
          ? editingChallenge.questions.map((q) => {
              const padded = [...q.options];
              while (padded.length < 4) padded.push('');
              return {
                prompt: q.prompt,
                options: padded.slice(0, 4),
                correctOptionIndex: q.correctOptionIndex,
                explanation: q.explanation || '',
              };
            })
          : [emptyQuestion()];
      setQuestions(mapped);
    } else {
      setTitle('');
      setDescription('');
      setStory('');
      setRewardPoints(50);
      setQuestions([emptyQuestion()]);
    }
  }, [open, editingChallenge]);

  const handleGenerateAiDraft = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await api.post<{
        success: boolean;
        source: string;
        draft: {
          title: string;
          description?: string;
          story?: string;
          rewardPoints: number;
          questions: PartnerChallengeQuestion[];
        };
      }>('/admin/partner/ai/generate-challenge', {
        destinationId,
        topic: aiTopic.trim() || undefined,
        questionCount: aiCount,
      });

      const d = res.data.draft;
      setTitle(d.title || '');
      setDescription(d.description || '');
      setStory(d.story || '');
      setRewardPoints(Math.min(150, Math.max(10, d.rewardPoints || 50)));
      if (Array.isArray(d.questions) && d.questions.length > 0) {
        setQuestions(
          d.questions.slice(0, 5).map((q) => {
            const opts = [...(q.options || [])];
            while (opts.length < 4) opts.push('');
            return {
              prompt: q.prompt || '',
              options: opts.slice(0, 4),
              correctOptionIndex: Math.min(Math.max(0, q.correctOptionIndex || 0), 3),
              explanation: q.explanation || '',
            };
          }),
        );
      }
      setAiDraftSource(res.data.source);
      toast.success('Đã tạo bản nháp bằng AI! Hãy rà soát độ chính xác trước khi lưu.');
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const updateQuestion = (index: number, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const nextOpts = [...q.options];
        nextOpts[optIndex] = value;
        return { ...q, options: nextOpts };
      }),
    );
  };

  const handleAddQuestion = () => {
    if (questions.length >= 5) {
      toast.info('Mỗi thử thách hỗ trợ tối đa 5 câu hỏi.');
      return;
    }
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      toast.error('Tiêu đề thử thách cần ít nhất 3 ký tự.');
      return;
    }

    const sanitizedQuestions = [];
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i]!;
      if (q.prompt.trim().length < 5) {
        toast.error(`Câu hỏi #${i + 1} cần ít nhất 5 ký tự.`);
        return;
      }
      const indexedValid = q.options
        .map((text, idx) => ({ text: text.trim(), origIdx: idx }))
        .filter((o) => o.text.length > 0);
      if (indexedValid.length < 2) {
        toast.error(`Câu hỏi #${i + 1} cần ít nhất 2 phương án trả lời.`);
        return;
      }
      const mappedCorrect = indexedValid.findIndex((o) => o.origIdx === q.correctOptionIndex);
      if (mappedCorrect === -1) {
        toast.error(`Câu hỏi #${i + 1}: Đáp án đúng đang bị bỏ trống.`);
        return;
      }
      sanitizedQuestions.push({
        prompt: q.prompt.trim(),
        options: indexedValid.map((o) => o.text),
        correctOptionIndex: mappedCorrect,
        explanation: q.explanation.trim() || undefined,
      });
    }

    setIsSubmitting(true);
    try {
      const payload = {
        destinationId,
        title: title.trim(),
        description: description.trim() || undefined,
        story: story.trim() || undefined,
        rewardPoints: Number(rewardPoints) || 50,
        questions: sanitizedQuestions,
      };

      if (editingChallenge) {
        await api.patch(`/admin/partner/challenges/${editingChallenge.id}`, payload);
        toast.success('Đã cập nhật thử thách văn hóa thành công!');
      } else {
        await api.post('/admin/partner/challenges', payload);
        toast.success('Đã tạo thử thách văn hóa cho KDL thành công!');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      size="lg"
      title={
        editingChallenge
          ? `Chỉnh sửa thử thách — ${destinationName}`
          : `Tạo Thử Thách & Câu Đố Văn Hóa — ${destinationName}`
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* AI Draft Assistant (Human-in-the-loop) */}
        <div className="rounded-xl border border-lotus-200 bg-gradient-to-r from-lotus-50/70 via-white to-leaf-50/60 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-river-900">
              <Sparkles className="size-4 text-lotus-600" />
              Trợ lý AI soạn nhanh bộ câu đố văn hóa (Đối tác duyệt trước khi lưu)
            </div>
            {aiDraftSource && (
              <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-[11px] font-semibold text-leaf-800">
                ✓ Đã nạp bản nháp ({aiDraftSource === 'gemini' ? 'Gemini AI' : 'Mẫu chuẩn KDL'})
              </span>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_92px_auto]">
            <Input
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Chủ đề gợi ý (VD: Lịch sử hình thành, đặc sản sen, nghệ nhân...)"
              className="text-xs"
            />
            <select
              aria-label="Số câu hỏi AI gợi ý"
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value))}
              className="h-10 rounded-control border border-sand-300 bg-white px-2 text-xs font-medium text-river-800 focus:border-leaf-600 focus:outline-none"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} câu hỏi
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="accent"
              size="sm"
              loading={isGeneratingAi}
              onClick={handleGenerateAiDraft}
              icon={<Sparkles className="size-3.5" />}
            >
              AI Soạn nháp
            </Button>
          </div>
          <p className="text-[11px] text-river-600">
            Lưu ý pháp lý & chất lượng: Đối tác cần rà soát kỹ thông tin lịch sử, địa danh trước khi bấm lưu xuất bản.
          </p>
        </div>

        {/* Basic Info */}
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <div>
            <label htmlFor="pch-title" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
              Tiêu đề thử thách *
            </label>
            <Input
              id="pch-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Giải mã bí mật Làng hoa trăm năm Sa Đéc"
              required
            />
          </div>
          <div>
            <label htmlFor="pch-points" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
              Điểm EXP (10–150) *
            </label>
            <Input
              id="pch-points"
              type="number"
              min={10}
              max={150}
              value={rewardPoints}
              onChange={(e) => setRewardPoints(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="pch-desc" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
            Mô tả ngắn (hiển thị trên thẻ thử thách)
          </label>
          <Input
            id="pch-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Trả lời đúng bộ câu đố để ghi dấu Hộ chiếu Sen Hồng..."
          />
        </div>

        <div>
          <label htmlFor="pch-story" className="block text-xs font-bold uppercase tracking-wider text-river-700 mb-1">
            Câu chuyện văn hóa / Thuyết minh sau khi hoàn thành
          </label>
          <textarea
            id="pch-story"
            rows={3}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Kể lại câu chuyện đặc sắc, giai thoại địa phương hoặc giá trị văn hóa mà du khách sẽ đọc sau khi mở khóa..."
            className="w-full rounded-control border border-sand-300 bg-white p-2.5 text-sm text-river-800 placeholder:text-river-400 focus:border-leaf-600 focus:outline-none focus:ring-1 focus:ring-leaf-600"
          />
        </div>

        {/* Multi-Question Builder (1-5 questions) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-river-900">
              Bộ câu hỏi trắc nghiệm ({questions.length}/5 câu)
            </h4>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={questions.length >= 5}
              onClick={handleAddQuestion}
              icon={<Plus className="size-3.5" />}
            >
              Thêm câu hỏi
            </Button>
          </div>

          {questions.map((q, qIdx) => (
            <div key={qIdx} className="rounded-xl border border-sand-300 bg-sand-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-leaf-700 px-2.5 py-0.5 text-xs font-bold text-white">
                  Câu {qIdx + 1}
                </span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" /> Xóa câu này
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-river-700 mb-1">
                  Nội dung câu hỏi *
                </label>
                <textarea
                  rows={2}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                  placeholder="Nhập câu hỏi rõ ràng, dễ hiểu cho du khách..."
                  className="w-full rounded-control border border-sand-300 bg-white p-2.5 text-xs text-river-900 focus:border-leaf-600 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-river-700">
                  Các phương án (Tích chọn đáp án đúng, tối thiểu 2 phương án):
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-opt-${qIdx}`}
                        checked={q.correctOptionIndex === optIdx}
                        onChange={() => updateQuestion(qIdx, { correctOptionIndex: optIdx })}
                        className="size-4 accent-leaf-600 cursor-pointer shrink-0"
                        title={`Chọn phương án ${String.fromCharCode(65 + optIdx)} là đáp án đúng`}
                      />
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                        placeholder={`Phương án ${String.fromCharCode(65 + optIdx)}${optIdx < 2 ? ' *' : ''}`}
                        className="text-xs"
                        required={optIdx < 2}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-river-700 mb-1">
                  Lời giải thích thú vị sau khi trả lời
                </label>
                <Input
                  value={q.explanation}
                  onChange={(e) => updateQuestion(qIdx, { explanation: e.target.value })}
                  placeholder="Giải thích ngắn gọn giúp du khách nhớ thêm kiến thức địa phương..."
                  className="text-xs"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-sand-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {editingChallenge ? 'Lưu thay đổi' : 'Phát hành thử thách'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
