'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminCalendarView } from './AdminCalendarView';
import { QuestionEditor, QuestionData, OptionData } from './QuestionEditor';

interface CandidateDate {
  candidateId: string;
  label: string;
  dateValue?: string | null;
  sortOrder: number;
}

interface QuestionAnswerData {
  questionId: string;
  question: string;
  type: 'text' | 'multiple_choice';
  multiSelect?: boolean;
  textAnswer?: string | null;
  selectedOptionId?: string | null;
  selectedOptionLabel?: string | null;
  selectedOptionIds?: string[] | null;
  selectedOptionLabels?: string[] | null;
}

interface QuestionSummaryOption {
  optionId: string;
  label: string;
  count: number;
  respondents: string[];
}

interface TextAnswerWithName {
  respondentName: string;
  answer: string;
}

interface QuestionSummaryData {
  questionId: string;
  question: string;
  type: 'text' | 'multiple_choice';
  multiSelect?: boolean;
  totalAnswers: number;
  textAnswers?: TextAnswerWithName[];
  options?: QuestionSummaryOption[];
}

interface ResponseData {
  responseId: string;
  name: string | null;
  email?: string | null;
  notes?: string | null;
  selectedDates: {
    candidateId: string;
    label: string;
  }[];
  questionAnswers?: QuestionAnswerData[];
  createdAt: string;
}

interface VoteCount {
  candidateId: string;
  label: string;
  dateValue?: string | null;
  voteCount: number;
}

interface Poll {
  pollId: string;
  title: string;
  description: string | null;
  status: 'open' | 'closed' | 'finalized';
  candidateDates: CandidateDate[];
  finalizedDate?: CandidateDate | null;
  deadline?: Date | string | null;
}

interface AdminDashboardProps {
  poll: Poll;
  responses: ResponseData[];
  totalResponses: number;
  voteCounts: VoteCount[];
  bestDates: VoteCount[];
  isTie: boolean;
  adminToken: string;
  locale: string;
  questionSummary?: QuestionSummaryData[];
}

export function AdminDashboard({
  poll,
  responses,
  totalResponses,
  voteCounts,
  adminToken,
  locale,
  questionSummary,
}: AdminDashboardProps) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState(poll.description || '');
  const [selectedFinalDate, setSelectedFinalDate] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [editingQuestions, setEditingQuestions] = useState<QuestionData[]>([]);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);

  // Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch(`/api/polls/${poll.pollId}/admin/${adminToken}/questions`);
        if (response.ok) {
          const data = await response.json();
          const formattedQuestions: QuestionData[] = data.questions.map((q: { questionId: string; type: 'text' | 'multiple_choice'; question: string; required: boolean; multiSelect?: boolean; options?: { optionId: string; label: string }[] }) => ({
            id: q.questionId,
            type: q.type,
            question: q.question,
            required: q.required,
            multiSelect: q.multiSelect,
            options: q.options?.map((o): OptionData => ({ id: o.optionId, label: o.label })),
          }));
          setQuestions(formattedQuestions);
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };
    fetchQuestions();
  }, [poll.pollId, adminToken]);

  const handleSaveQuestions = async () => {
    setIsSavingQuestions(true);
    try {
      const response = await fetch(`/api/polls/${poll.pollId}/admin/${adminToken}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: editingQuestions }),
      });

      if (!response.ok) {
        throw new Error('Failed to save questions');
      }

      setQuestions(editingQuestions);
      setShowQuestionsModal(false);
    } catch (error) {
      console.error('Error saving questions:', error);
      alert('Failed to save questions. Please try again.');
    } finally {
      setIsSavingQuestions(false);
    }
  };

  const responderUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${locale}/poll/${poll.pollId}`
    : '';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(responderUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const performAction = async (action: 'close' | 'reopen' | 'finalize', finalizedDateId?: string) => {
    if (action === 'close' && !confirm(t('closeConfirm'))) return;
    if (action === 'reopen' && !confirm(t('reopenConfirm'))) return;
    if (action === 'finalize' && !confirm(t('finalizeConfirm'))) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/polls/${poll.pollId}/admin/${adminToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, finalizedDateId }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform action');
      }

      router.refresh();
      window.location.reload();
    } catch (error) {
      console.error('Error performing action:', error);
      alert('Failed to perform action. Please try again.');
    } finally {
      setIsLoading(false);
      setShowFinalizeModal(false);
    }
  };

  const handleSetDeadline = async (deadlineValue: string | null) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/polls/${poll.pollId}/admin/${adminToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setDeadline',
          deadline: deadlineValue ? new Date(deadlineValue).toISOString() : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set deadline');
      }

      router.refresh();
      window.location.reload();
    } catch (error) {
      console.error('Error setting deadline:', error);
      alert('Failed to set deadline. Please try again.');
    } finally {
      setIsLoading(false);
      setShowDeadlineModal(false);
    }
  };

  const handleUpdateDescription = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/polls/${poll.pollId}/admin/${adminToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateDescription',
          description: descriptionInput.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update description');
      }

      router.refresh();
      window.location.reload();
    } catch (error) {
      console.error('Error updating description:', error);
      alert('Failed to update description. Please try again.');
    } finally {
      setIsLoading(false);
      setShowDescriptionModal(false);
    }
  };

  const formatDeadline = (deadline: Date | string | null | undefined) => {
    if (!deadline) return null;
    const date = typeof deadline === 'string' ? new Date(deadline) : deadline;
    return date.toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = () => {
    switch (poll.status) {
      case 'open':
        return 'bg-status-all-bg text-status-all';
      case 'closed':
        return 'bg-status-most-bg text-status-most';
      case 'finalized':
        return 'bg-primary-50 text-primary-600';
    }
  };

  const getStatusText = () => {
    switch (poll.status) {
      case 'open':
        return t('statusOpen');
      case 'closed':
        return t('statusClosed');
      case 'finalized':
        return t('statusFinalized');
    }
  };

  const hasCalendarDates = voteCounts.some((vc) => vc.dateValue);

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Poll Info Card */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="break-words">{poll.title}</CardTitle>
                <div className="flex items-start gap-2 mt-1">
                  {poll.description ? (
                    <CardDescription className="break-words flex-1">{poll.description}</CardDescription>
                  ) : (
                    <CardDescription className="text-text-muted italic flex-1">
                      {locale === 'ja' ? '説明なし' : 'No description'}
                    </CardDescription>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionInput(poll.description || '');
                      setShowDescriptionModal(true);
                    }}
                    className="text-text-muted hover:text-text-secondary p-1 shrink-0"
                    title={locale === 'ja' ? '説明を編集' : 'Edit description'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-sm font-medium shrink-0',
                  getStatusColor()
                )}
              >
                {getStatusText()}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Shareable Link */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                {t('shareLink')}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={responderUrl}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded-lg bg-surface-secondary text-text-primary truncate"
                />
                <Button onClick={copyToClipboard} variant="outline" size="sm" className="w-full sm:w-auto shrink-0">
                  {copiedLink ? tCommon('copied') : t('copyLink')}
                </Button>
              </div>
            </div>

            {/* Actions */}
            {poll.status !== 'finalized' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  {t('actions')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {poll.status === 'open' ? (
                    <Button
                      variant="secondary"
                      onClick={() => performAction('close')}
                      disabled={isLoading}
                    >
                      {t('closePoll')}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => performAction('reopen')}
                      disabled={isLoading}
                    >
                      {t('reopenPoll')}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => setShowFinalizeModal(true)}
                    disabled={isLoading}
                  >
                    {t('finalizePoll')}
                  </Button>
                </div>
              </div>
            )}

            {poll.status === 'finalized' && poll.finalizedDate && (
              <div className="p-4 bg-status-all-bg border-2 border-status-all rounded-lg">
                <p className="text-sm text-status-all font-medium mb-1">
                  {t('statusFinalized')}
                </p>
                <p className="text-lg font-semibold text-status-all">
                  {poll.finalizedDate.label}
                </p>
              </div>
            )}

            {/* Deadline Section */}
            {poll.status !== 'finalized' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  {t('deadline')}
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {poll.deadline ? (
                    <span className="text-sm text-text-secondary w-full sm:w-auto">
                      {formatDeadline(poll.deadline)}
                    </span>
                  ) : (
                    <span className="text-sm text-text-muted italic w-full sm:w-auto">
                      {t('noDeadlineSet')}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (poll.deadline) {
                        const d = typeof poll.deadline === 'string' ? new Date(poll.deadline) : poll.deadline;
                        setDeadlineInput(d.toISOString().slice(0, 16));
                      } else {
                        setDeadlineInput('');
                      }
                      setShowDeadlineModal(true);
                    }}
                    disabled={isLoading}
                  >
                    {poll.deadline ? t('editDeadline') : t('setDeadline')}
                  </Button>
                  {poll.deadline && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDeadline(null)}
                      disabled={isLoading}
                    >
                      {t('removeDeadline')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Questions Card */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">
                {locale === 'ja' ? '追加質問' : 'Additional Questions'}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingQuestions([...questions]);
                  setShowQuestionsModal(true);
                }}
              >
                {locale === 'ja' ? '編集' : 'Edit'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <p className="text-text-muted text-sm">
                {locale === 'ja' ? '質問がありません' : 'No additional questions'}
              </p>
            ) : (
              <div className="space-y-3">
                {questions.map((q, index) => (
                  <div key={index} className="border border-border rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-text-muted text-sm shrink-0">Q{index + 1}.</span>
                      <div className="flex-1">
                        <p className="text-text-primary font-medium">
                          {q.question}
                          {q.required && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {q.type === 'text'
                            ? (locale === 'ja' ? 'テキスト回答' : 'Text answer')
                            : (locale === 'ja' ? `選択式 (${q.options?.length || 0}個の選択肢)` : `Multiple choice (${q.options?.length || 0} options)`)}
                        </p>
                        {q.type === 'multiple_choice' && q.options && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {q.options.map((opt, i) => (
                              <span
                                key={opt.id || i}
                                className="text-xs px-2 py-0.5 bg-surface-secondary rounded"
                              >
                                {opt.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question Response Summary Card */}
        {questionSummary && questionSummary.length > 0 && totalResponses > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {locale === 'ja' ? '回答サマリー' : 'Response Summary'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {questionSummary.map((qs) => (
                  <div key={qs.questionId} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
                    <div className="font-medium text-text-primary mb-2">{qs.question}</div>
                    {qs.type === 'text' ? (
                      <div className="space-y-2">
                        <p className="text-sm text-text-muted">
                          {locale === 'ja'
                            ? `${qs.totalAnswers}件の回答`
                            : `${qs.totalAnswers} response${qs.totalAnswers !== 1 ? 's' : ''}`}
                        </p>
                        {qs.textAnswers && qs.textAnswers.length > 0 && (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {qs.textAnswers.map((item, i) => (
                              <div
                                key={i}
                                className="bg-surface-secondary rounded px-3 py-2"
                              >
                                <div className="text-xs text-primary-600 font-medium mb-1">
                                  {item.respondentName}
                                </div>
                                <div className="text-sm text-text-primary">
                                  {item.answer}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {qs.options?.map((opt) => {
                          const percentage = totalResponses > 0
                            ? Math.round((opt.count / totalResponses) * 100)
                            : 0;
                          return (
                            <div key={opt.optionId}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-text-primary font-medium">{opt.label}</span>
                                <span className="text-text-muted">
                                  {opt.count} ({percentage}%)
                                </span>
                              </div>
                              <div className="h-2 bg-surface-secondary rounded-full overflow-hidden mb-2">
                                <div
                                  className="h-full bg-primary-500 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              {opt.respondents && opt.respondents.length > 0 && (
                                <div className="flex flex-wrap gap-1 pl-2">
                                  {opt.respondents.map((name, i) => (
                                    <span
                                      key={i}
                                      className="text-xs px-2 py-0.5 bg-surface-secondary text-text-secondary rounded"
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date Overview Card (Calendar) */}
        {hasCalendarDates && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {locale === 'ja' ? '日程カレンダー' : 'Date Overview'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminCalendarView
                voteCounts={voteCounts}
                totalResponses={totalResponses}
                locale={locale}
              />
            </CardContent>
          </Card>
        )}

        {/* Respondents Card */}
        {responses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t('respondents')} ({totalResponses})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {responses.map((response) => (
                  <span
                    key={response.responseId}
                    className="inline-flex items-center px-3 py-1.5 bg-surface-secondary border border-border rounded-full text-sm"
                  >
                    <span className="font-medium text-text-primary">
                      {response.name || (
                        <span className="text-text-muted italic">{t('anonymous')}</span>
                      )}
                    </span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Response Details Card */}
        {responses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t('responsesList')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {responses.map((response) => (
                  <div key={response.responseId} className="border border-border rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                      <div>
                        <div className="font-medium text-text-primary text-lg">
                          {response.name || (
                            <span className="text-text-muted italic">{t('anonymous')}</span>
                          )}
                        </div>
                        <div className="text-sm text-text-secondary break-all">
                          {response.email || (
                            <span className="text-text-muted italic">{t('noEmail')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="text-sm font-medium text-text-secondary mb-1">
                        {t('selectedDates')}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {response.selectedDates.map((d) => (
                          <span
                            key={d.candidateId}
                            className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded text-sm"
                          >
                            {d.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    {response.questionAnswers && response.questionAnswers.length > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium text-text-secondary mb-2">
                          {locale === 'ja' ? '追加質問への回答' : 'Question Responses'}
                        </div>
                        <div className="space-y-2">
                          {response.questionAnswers.map((qa) => (
                            <div key={qa.questionId} className="bg-surface-secondary rounded-lg p-3">
                              <div className="text-sm text-text-muted mb-1">{qa.question}</div>
                              <div className="text-text-primary">
                                {qa.type === 'text' ? (
                                  qa.textAnswer || (
                                    <span className="text-text-muted italic">
                                      {locale === 'ja' ? '未回答' : 'No answer'}
                                    </span>
                                  )
                                ) : qa.multiSelect ? (
                                  qa.selectedOptionLabels && qa.selectedOptionLabels.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {qa.selectedOptionLabels.map((label, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded text-sm">
                                          {label}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-text-muted italic">
                                      {locale === 'ja' ? '未選択' : 'Not selected'}
                                    </span>
                                  )
                                ) : (
                                  qa.selectedOptionLabel || (
                                    <span className="text-text-muted italic">
                                      {locale === 'ja' ? '未選択' : 'Not selected'}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {response.notes && (
                      <div>
                        <div className="text-sm font-medium text-text-secondary mb-1">
                          {t('respondentNotes')}
                        </div>
                        <div className="text-text-primary bg-surface-secondary rounded-lg p-3 whitespace-pre-wrap">
                          {response.notes}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Deadline Modal */}
      {showDeadlineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t('setDeadline')}</CardTitle>
              <CardDescription>{t('deadlineDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="datetime-local"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeadlineModal(false);
                    setDeadlineInput('');
                  }}
                  className="flex-1"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSetDeadline(deadlineInput || null)}
                  disabled={isLoading}
                  isLoading={isLoading}
                  className="flex-1"
                >
                  {t('saveDeadline')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t('finalizePoll')}</CardTitle>
              <CardDescription>{t('selectFinalDate')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {poll.candidateDates.map((date) => (
                  <label
                    key={date.candidateId}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                      selectedFinalDate === date.candidateId
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-border hover:border-border-secondary'
                    )}
                  >
                    <input
                      type="radio"
                      name="finalDate"
                      value={date.candidateId}
                      checked={selectedFinalDate === date.candidateId}
                      onChange={() => setSelectedFinalDate(date.candidateId)}
                      className="w-5 h-5 text-primary-600"
                    />
                    <span className="font-medium text-text-primary">{date.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowFinalizeModal(false);
                    setSelectedFinalDate(null);
                  }}
                  className="flex-1"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (selectedFinalDate) {
                      performAction('finalize', selectedFinalDate);
                    }
                  }}
                  disabled={!selectedFinalDate || isLoading}
                  isLoading={isLoading}
                  className="flex-1"
                >
                  {t('confirmFinalize')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Description Edit Modal */}
      {showDescriptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{locale === 'ja' ? '説明を編集' : 'Edit Description'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder={locale === 'ja' ? 'イベントの詳細を追加' : 'Add details about the event'}
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <p className="text-xs text-text-muted text-right">{descriptionInput.length}/500</p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDescriptionModal(false);
                    setDescriptionInput(poll.description || '');
                  }}
                  className="flex-1"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleUpdateDescription}
                  disabled={isLoading}
                  isLoading={isLoading}
                  className="flex-1"
                >
                  {tCommon('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Questions Edit Modal */}
      {showQuestionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="w-full max-w-2xl my-8">
            <CardHeader>
              <CardTitle>{locale === 'ja' ? '追加質問を編集' : 'Edit Additional Questions'}</CardTitle>
              <CardDescription>
                {locale === 'ja'
                  ? '参加者に回答してもらう追加の質問を設定できます'
                  : 'Add additional questions for participants to answer'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <QuestionEditor
                questions={editingQuestions}
                onChange={setEditingQuestions}
                locale={locale}
              />

              <div className="flex gap-2 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowQuestionsModal(false);
                    setEditingQuestions([]);
                  }}
                  className="flex-1"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveQuestions}
                  disabled={isSavingQuestions}
                  isLoading={isSavingQuestions}
                  className="flex-1"
                >
                  {tCommon('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
