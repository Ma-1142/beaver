'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { AdminDashboard } from '@/components/poll/AdminDashboard';
import { Card, CardContent } from '@/components/ui';

interface CandidateDate {
  candidateId: string;
  label: string;
  sortOrder: number;
}

interface ResponseData {
  responseId: string;
  name: string | null;
  email?: string | null;
  selectedDates: {
    candidateId: string;
    label: string;
  }[];
  createdAt: string;
}

interface VoteCount {
  candidateId: string;
  label: string;
  voteCount: number;
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

interface Poll {
  pollId: string;
  title: string;
  description: string | null;
  status: 'open' | 'closed' | 'finalized';
  candidateDates: CandidateDate[];
  finalizedDate?: CandidateDate | null;
}

interface AdminData {
  poll: Poll;
  responses: ResponseData[];
  totalResponses: number;
  voteCounts: VoteCount[];
  bestDates: VoteCount[];
  isTie: boolean;
  questionSummary?: QuestionSummaryData[];
}

export default function AdminPage() {
  const params = useParams();
  const pollId = params.pollId as string;
  const adminToken = params.adminToken as string;
  const locale = params.locale as string;
  const t = useTranslations('common');
  const tErrors = useTranslations('errors');

  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const response = await fetch(`/api/polls/${pollId}/admin/${adminToken}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError(tErrors('unauthorized'));
          } else {
            setError(tErrors('serverError'));
          }
          return;
        }

        const data = await response.json();
        setAdminData(data);
      } catch (err) {
        console.error('Error fetching admin data:', err);
        setError(tErrors('networkError'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminData();
  }, [pollId, adminToken, tErrors]);

  if (isLoading) {
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

  if (!adminData) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-gray-500">{tErrors('pollNotFound')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminDashboard
      poll={adminData.poll}
      responses={adminData.responses}
      totalResponses={adminData.totalResponses}
      voteCounts={adminData.voteCounts}
      bestDates={adminData.bestDates}
      isTie={adminData.isTie}
      adminToken={adminToken}
      locale={locale}
      questionSummary={adminData.questionSummary}
    />
  );
}
