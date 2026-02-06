'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { ResponseForm } from '@/components/poll/ResponseForm';
import { Card, CardContent } from '@/components/ui';
import { useRespondentToken } from '@/hooks/useRespondentToken';
import { useRecentPolls } from '@/hooks/useRecentPolls';

interface CandidateDate {
  candidateId: string;
  label: string;
  sortOrder: number;
  dateValue?: string | null;
}

interface QuestionOption {
  optionId: string;
  label: string;
  sortOrder: number;
}

interface Question {
  questionId: string;
  type: 'text' | 'multiple_choice';
  question: string;
  required: boolean;
  options?: QuestionOption[];
}

interface Poll {
  pollId: string;
  title: string;
  description: string | null;
  status: 'open' | 'closed' | 'finalized';
  candidateDates: CandidateDate[];
  finalizedDate?: CandidateDate | null;
  deadline?: string | null;
  questions?: Question[];
}

interface QuestionAnswer {
  questionId: string;
  textAnswer?: string | null;
  selectedOptionId?: string | null;
}

interface ExistingResponse {
  responseId: string;
  name: string | null;
  email?: string | null;
  selectedDates: string[];
  questionAnswers?: QuestionAnswer[];
}

interface PollData {
  poll: Poll;
  existingResponse: ExistingResponse | null;
  totalResponses: number;
  availabilityCounts: Record<string, number>;
}

export default function ResponsePage() {
  const params = useParams();
  const pollId = params.pollId as string;
  const locale = params.locale as string;
  const t = useTranslations('common');
  const tErrors = useTranslations('errors');
  const { token, isLoading: tokenLoading } = useRespondentToken(pollId);

  const [pollData, setPollData] = useState<PollData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addRecentPoll } = useRecentPolls();

  // Track this poll visit when data is loaded
  useEffect(() => {
    if (pollData?.poll) {
      addRecentPoll({
        pollId: pollData.poll.pollId,
        title: pollData.poll.title,
        isAdmin: false,
        hasSubmitted: !!pollData.existingResponse,
        deadline: pollData.poll.deadline,
      });
    }
  }, [pollData?.poll, pollData?.existingResponse, addRecentPoll]);

  useEffect(() => {
    const fetchPoll = async () => {
      if (tokenLoading) return;

      try {
        const url = new URL(`/api/polls/${pollId}`, window.location.origin);
        if (token) {
          url.searchParams.set('respondentToken', token);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
          if (response.status === 404) {
            setError(tErrors('pollNotFound'));
          } else {
            setError(tErrors('serverError'));
          }
          return;
        }

        const data = await response.json();
        setPollData(data);
      } catch (err) {
        console.error('Error fetching poll:', err);
        setError(tErrors('networkError'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoll();
  }, [pollId, token, tokenLoading, tErrors]);

  if (isLoading || tokenLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-gray-500">{t('loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!pollData) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-gray-500">{tErrors('pollNotFound')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ResponseForm
      poll={pollData.poll}
      existingResponse={pollData.existingResponse}
      locale={locale}
      availabilityCounts={new Map(Object.entries(pollData.availabilityCounts || {}))}
      totalResponses={pollData.totalResponses || 0}
    />
  );
}
