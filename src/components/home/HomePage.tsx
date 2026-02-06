'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { useRecentPolls } from '@/hooks/useRecentPolls';
import { motion } from 'framer-motion';

interface HomePageProps {
  locale: string;
}

function formatDeadline(deadline: string | null | undefined, locale: string): string | null {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const isPast = date < now;

  const formatted = date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return isPast ? null : formatted;
}

export function HomePage({ locale }: HomePageProps) {
  const t = useTranslations('home');
  const { recentPolls, isLoaded } = useRecentPolls();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center py-4"
      >
        <h1 className="text-2xl font-bold text-text-primary">{t('welcome')}</h1>
        <p className="text-text-secondary mt-1">{t('description')}</p>
      </motion.div>

      {/* Create New Poll */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Link href={`/${locale}/new`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-primary-300">
            <CardHeader>
              <CardTitle className="text-primary-600">{t('createNew')}</CardTitle>
              <CardDescription>{t('createNewDescription')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </motion.div>

      {/* Recent Polls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t('recentPolls')}</CardTitle>
            <CardDescription>{t('recentPollsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!isLoaded ? (
              <p className="text-text-muted text-sm">...</p>
            ) : recentPolls.filter(p => !p.isAdmin).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-text-secondary">{t('noRecentPolls')}</p>
                <p className="text-text-muted text-sm mt-1">{t('noRecentPollsDescription')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentPolls.filter(p => !p.isAdmin).map((poll) => {
                  const deadlineStr = formatDeadline(poll.deadline, locale);
                  return (
                    <Link
                      key={poll.pollId}
                      href={`/${locale}/poll/${poll.pollId}`}
                      className="block p-3 rounded-lg border border-border hover:bg-surface-secondary transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {poll.hasSubmitted && (
                            <span className="text-status-all shrink-0" title={t('submitted')}>✓</span>
                          )}
                          <span className="font-medium text-text-primary truncate">{poll.title}</span>
                        </div>
                        {deadlineStr && (
                          <span className="text-xs text-text-muted shrink-0">
                            {t('deadline')}: {deadlineStr}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
