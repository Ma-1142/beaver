'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Calendar, parseISODate } from '@/components/ui';

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

interface ResultsDisplayProps {
  poll: Poll;
  results: ResultItem[];
  totalResponses: number;
  bestDates: string[];
  isTie: boolean;
  lastUpdated: Date | null;
}

export function ResultsDisplay({
  poll,
  results,
  totalResponses,
  bestDates,
  isTie,
  lastUpdated,
}: ResultsDisplayProps) {
  const t = useTranslations('results');
  const tResponse = useTranslations('response');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  // Check if we have calendar dates
  const hasCalendarDates = useMemo(() => {
    return results.some((r) => r.dateValue);
  }, [results]);

  // Convert results to calendar format
  const allowedDates = useMemo(() => {
    return results
      .filter((r) => r.dateValue)
      .map((r) => parseISODate(r.dateValue!));
  }, [results]);

  // Availability counts by dateValue
  const calendarAvailabilityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    results.forEach((r) => {
      if (r.dateValue) {
        counts.set(r.dateValue, r.voteCount);
      }
    });
    return counts;
  }, [results]);

  // Best dates as Date objects for highlighting
  const bestDateValues = useMemo(() => {
    return results
      .filter((r) => bestDates.includes(r.candidateId) && r.dateValue)
      .map((r) => r.dateValue!);
  }, [results, bestDates]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{poll.title}</CardTitle>
          {poll.description && (
            <CardDescription>{poll.description}</CardDescription>
          )}
          <div className="flex flex-wrap justify-between items-center gap-1 text-sm text-text-secondary mt-2">
            <span>{t('totalResponses', { count: totalResponses })}</span>
            {lastUpdated && (
              <span>{t('lastUpdated', { time: formatTime(lastUpdated) })}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {poll.status === 'finalized' && poll.finalizedDate && (
            <div className="mb-6 p-4 bg-status-all-bg border-2 border-status-all rounded-lg">
              <p className="text-sm text-status-all font-medium mb-1">
                {t('finalized')}
              </p>
              <p className="text-lg font-semibold text-status-all">
                {poll.finalizedDate.label}
              </p>
            </div>
          )}

          {totalResponses === 0 ? (
            <p className="text-center text-text-secondary py-8">{t('noResponses')}</p>
          ) : (
            <div className="space-y-4">
              {bestDates.length > 0 && poll.status !== 'finalized' && (
                <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="text-sm font-medium text-primary-600">
                    {t('bestDate')}: {isTie ? `${t('tie')} - ` : ''}
                    {results
                      .filter((r) => bestDates.includes(r.candidateId))
                      .map((r) => r.label)
                      .join(', ')}
                  </p>
                </div>
              )}

              {hasCalendarDates ? (
                <div className="border border-border rounded-lg p-4 bg-surface">
                  <Calendar
                    selectedDates={[]}
                    onDatesChange={() => {}}
                    allowedDates={allowedDates}
                    locale={locale}
                    availabilityCounts={calendarAvailabilityCounts}
                    totalResponses={totalResponses}
                    readOnly
                    highlightDates={bestDateValues}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((result) => (
                    <div
                      key={result.candidateId}
                      className={`p-3 rounded-lg border ${
                        bestDates.includes(result.candidateId) && poll.status !== 'finalized'
                          ? 'bg-primary-50 border-primary-200'
                          : 'bg-surface-secondary border-border'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-text-primary">{result.label}</span>
                        <span className="text-sm text-text-secondary">
                          {t('votes', { count: result.voteCount })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {poll.status === 'open' && (
            <div className="mt-6 pt-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/${locale}/poll/${poll.pollId}`)}
              >
                {tResponse('editResponse')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
