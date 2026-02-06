'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { motion } from 'framer-motion';
import { useRespondentToken } from '@/hooks/useRespondentToken';

interface QuestionOption {
  optionId: string;
  label: string;
}

interface Question {
  questionId: string;
  type: 'text' | 'multiple_choice';
  question: string;
  multiSelect?: boolean;
  options?: QuestionOption[];
}

interface QuestionAnswer {
  questionId: string;
  textAnswer?: string | null;
  selectedOptionId?: string | null;
  selectedOptionIds?: string[] | null;
}

interface CandidateDate {
  candidateId: string;
  label: string;
}

interface ResponseData {
  poll: {
    title: string;
    candidateDates: CandidateDate[];
    questions?: Question[];
  };
  existingResponse: {
    name: string | null;
    selectedDates: string[];
    notes?: string | null;
    questionAnswers?: QuestionAnswer[];
  } | null;
}

export default function ConfirmationPage() {
  const params = useParams();
  const pollId = params.pollId as string;
  const locale = params.locale as string;
  const router = useRouter();
  const t = useTranslations('response');
  const { token } = useRespondentToken(pollId);

  const [data, setData] = useState<ResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMyAnswers, setShowMyAnswers] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/polls/${pollId}?respondentToken=${token}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (err) {
        console.error('Error fetching response data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [pollId, token]);

  // Get selected date labels
  const getSelectedDateLabels = () => {
    if (!data?.existingResponse?.selectedDates || !data?.poll?.candidateDates) return [];
    return data.existingResponse.selectedDates
      .map((id) => data.poll.candidateDates.find((d) => d.candidateId === id)?.label)
      .filter((label): label is string => !!label);
  };

  // Get answer for a question
  const getQuestionAnswer = (question: Question): string | string[] | null => {
    const answer = data?.existingResponse?.questionAnswers?.find(
      (a) => a.questionId === question.questionId
    );
    if (!answer) return null;

    if (question.type === 'text') {
      return answer.textAnswer || null;
    }

    if (question.multiSelect && answer.selectedOptionIds) {
      return answer.selectedOptionIds
        .map((id) => question.options?.find((o) => o.optionId === id)?.label)
        .filter((label): label is string => !!label);
    }

    if (answer.selectedOptionId) {
      return question.options?.find((o) => o.optionId === answer.selectedOptionId)?.label || null;
    }

    return null;
  };

  const selectedDates = getSelectedDateLabels();
  const questions = data?.poll?.questions || [];

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-status-all text-center">
              {t('submitted')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-text-secondary">{t('thankYou')}</p>

            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => router.push(`/${locale}/poll/${pollId}/results`)}
              >
                {t('viewResults')}
              </Button>

              {/* View My Answers button */}
              {!isLoading && data?.existingResponse && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowMyAnswers(!showMyAnswers)}
                >
                  {showMyAnswers
                    ? (locale === 'ja' ? '回答を隠す' : 'Hide My Answers')
                    : (locale === 'ja' ? '回答を見る' : 'View My Answers')}
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/${locale}/poll/${pollId}`)}
              >
                {t('editResponse')}
              </Button>
            </div>

            {/* Show submitted response when toggled */}
            {showMyAnswers && data?.existingResponse && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border border-border rounded-lg p-4 space-y-4 bg-surface-secondary mt-4"
              >
                <h3 className="font-medium text-text-primary">
                  {locale === 'ja' ? '回答内容' : 'Your Response'}
                </h3>

                {/* Name */}
                {data.existingResponse.name && (
                  <div>
                    <p className="text-sm text-text-muted mb-1">
                      {locale === 'ja' ? '名前' : 'Name'}
                    </p>
                    <p className="text-text-primary">{data.existingResponse.name}</p>
                  </div>
                )}

                {/* Selected dates */}
                {selectedDates.length > 0 && (
                  <div>
                    <p className="text-sm text-text-muted mb-2">
                      {locale === 'ja' ? '選択した日程' : 'Selected dates'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDates.map((label, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-sm"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Question answers */}
                {questions.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-text-muted">
                      {locale === 'ja' ? '追加質問への回答' : 'Question responses'}
                    </p>
                    {questions.map((q) => {
                      const answer = getQuestionAnswer(q);
                      return (
                        <div key={q.questionId} className="bg-surface rounded-lg p-3">
                          <p className="text-sm text-text-muted mb-1">{q.question}</p>
                          <div className="text-text-primary">
                            {answer === null ? (
                              <span className="text-text-muted italic">
                                {locale === 'ja' ? '未回答' : 'No answer'}
                              </span>
                            ) : Array.isArray(answer) ? (
                              <div className="flex flex-wrap gap-1">
                                {answer.map((label, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 bg-primary-50 text-primary-600 rounded text-sm"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              answer
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Notes */}
                {data.existingResponse.notes && (
                  <div>
                    <p className="text-sm text-text-muted mb-1">
                      {locale === 'ja' ? 'メモ' : 'Notes'}
                    </p>
                    <p className="text-text-primary whitespace-pre-wrap">
                      {data.existingResponse.notes}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
