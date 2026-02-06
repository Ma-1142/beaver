'use client';

import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface OptionData {
  id?: string; // Existing option ID (for preserving answers)
  label: string;
}

export interface QuestionData {
  id?: string;
  type: 'text' | 'multiple_choice';
  question: string;
  required: boolean;
  multiSelect?: boolean; // For multiple choice: allow multiple selections
  options?: OptionData[];
}

interface QuestionEditorProps {
  questions: QuestionData[];
  onChange: (questions: QuestionData[]) => void;
  locale: string;
}

export function QuestionEditor({ questions, onChange, locale }: QuestionEditorProps) {
  const isJa = locale === 'ja';

  const addQuestion = (type: 'text' | 'multiple_choice') => {
    const newQuestion: QuestionData = {
      type,
      question: '',
      required: false,
      multiSelect: type === 'multiple_choice' ? false : undefined,
      options: type === 'multiple_choice' ? [{ label: '' }, { label: '' }] : undefined,
    };
    onChange([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<QuestionData>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    onChange(newQuestions);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return;
    }

    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    onChange(newQuestions);
  };

  const addOption = (questionIndex: number) => {
    const question = questions[questionIndex];
    if (question.options) {
      updateQuestion(questionIndex, {
        options: [...question.options, { label: '' }],
      });
    }
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const question = questions[questionIndex];
    if (question.options) {
      const newOptions = [...question.options];
      // Preserve the id when updating label
      newOptions[optionIndex] = { ...newOptions[optionIndex], label: value };
      updateQuestion(questionIndex, { options: newOptions });
    }
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex];
    if (question.options && question.options.length > 2) {
      updateQuestion(questionIndex, {
        options: question.options.filter((_, i) => i !== optionIndex),
      });
    }
  };

  return (
    <div className="space-y-4">
      {questions.length === 0 ? (
        <div className="text-center py-8 text-text-muted border border-dashed border-border rounded-lg">
          {isJa ? '質問がありません' : 'No questions added'}
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question, qIndex) => (
            <div
              key={qIndex}
              className="border border-border rounded-lg p-4 bg-surface"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-muted">
                    {isJa ? `質問 ${qIndex + 1}` : `Q${qIndex + 1}`}
                  </span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      question.type === 'text'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    )}
                  >
                    {question.type === 'text'
                      ? (isJa ? 'テキスト' : 'Text')
                      : question.multiSelect
                        ? (isJa ? '複数選択' : 'Multi-select')
                        : (isJa ? '単一選択' : 'Single-select')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(qIndex, 'up')}
                    disabled={qIndex === 0}
                    className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                    title={isJa ? '上へ移動' : 'Move up'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(qIndex, 'down')}
                    disabled={qIndex === questions.length - 1}
                    className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                    title={isJa ? '下へ移動' : 'Move down'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    className="p-1 text-red-500 hover:text-red-700"
                    title={isJa ? '削除' : 'Delete'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={question.question}
                    onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                    placeholder={isJa ? '質問を入力...' : 'Enter question...'}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                    maxLength={500}
                  />
                </div>

                {question.type === 'multiple_choice' && question.options && (
                  <div className="space-y-2 pl-4 border-l-2 border-border">
                    {question.options.map((option, oIndex) => (
                      <div key={option.id || oIndex} className="flex items-center gap-2">
                        <span className="text-text-muted text-sm w-6">{oIndex + 1}.</span>
                        <input
                          type="text"
                          value={option.label}
                          onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                          placeholder={isJa ? `選択肢 ${oIndex + 1}` : `Option ${oIndex + 1}`}
                          className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          maxLength={200}
                        />
                        {question.options && question.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(qIndex, oIndex)}
                            className="p-1 text-text-muted hover:text-red-500"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {isJa ? '選択肢を追加' : 'Add option'}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(e) => updateQuestion(qIndex, { required: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-text-secondary">
                      {isJa ? '必須' : 'Required'}
                    </span>
                  </label>
                  {question.type === 'multiple_choice' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={question.multiSelect || false}
                        onChange={(e) => updateQuestion(qIndex, { multiSelect: e.target.checked })}
                        className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-text-secondary">
                        {isJa ? '複数選択可' : 'Allow multiple'}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addQuestion('text')}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {isJa ? 'テキスト質問を追加' : 'Add Text Question'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addQuestion('multiple_choice')}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {isJa ? '選択式質問を追加' : 'Add Multiple Choice'}
        </Button>
      </div>
    </div>
  );
}
