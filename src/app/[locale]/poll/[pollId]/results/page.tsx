'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { ResultsDisplay } from '@/components/poll/ResultsDisplay';
import { Card, CardContent } from '@/components/ui';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

interface ResultItem {
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
  finalizedDate?: {
    candidateId: string;
    label: string;
  } | null;
}

interface ResultsData {
  poll: Poll;
  results: ResultItem[];
  totalResponses: number;
  bestDates: string[];
  isTie: boolean;
}

export default function ResultsPage() {
  const params = useParams();
  const pollId = params.pollId as string;
  const t = useTranslations('common');
  const tErrors = useTranslations('errors');

  const fetchResults = useCallback(async (): Promise<ResultsData> => {
    const response = await fetch(`/api/polls/${pollId}/results`);
    if (!response.ok) {
      throw new Error('Failed to fetch results');
    }
    return response.json();
  }, [pollId]);

  const { data, isLoading, error, lastUpdated } = useAutoRefresh({
    fetchFn: fetchResults,
    enabled: false,
  });

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-gray-500">{t('loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-red-600">{tErrors('serverError')}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-gray-500">{tErrors('pollNotFound')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ResultsDisplay
      poll={data.poll}
      results={data.results}
      totalResponses={data.totalResponses}
      bestDates={data.bestDates}
      isTie={data.isTie}
      lastUpdated={lastUpdated}
    />
  );
}
