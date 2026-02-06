'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, Calendar, parseISODate, toISODateString } from '@/components/ui';
import { useRespondentToken } from '@/hooks/useRespondentToken';
import { isValidPin } from '@/lib/pin';
import { TwoColumnLayout } from '@/components/layout/TwoColumnLayout';

interface CandidateDate {
  candidateId: string;
  label: string;
  dateValue?: string | null;
  sortOrder: number;
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
  multiSelect?: boolean;
  options?: QuestionOption[];
}

interface Poll {
  pollId: string;
  title: string;
  description: string | null;
  status: 'open' | 'closed' | 'finalized';
  candidateDates: CandidateDate[];
  finalizedDate?: CandidateDate | null;
  deadline?: Date | string | null;
  questions?: Question[];
}

interface QuestionAnswer {
  questionId: string;
  textAnswer?: string | null;
  selectedOptionId?: string | null;
  selectedOptionIds?: string[] | null;
}

interface ExistingResponse {
  responseId: string;
  name: string | null;
  email?: string | null;
  selectedDates: string[];
  notes?: string | null;
  questionAnswers?: QuestionAnswer[];
}

interface ResponseFormProps {
  poll: Poll;
  existingResponse: ExistingResponse | null;
  locale: string;
  availabilityCounts?: Map<string, number>;
  totalResponses?: number;
}

// localStorage key for storing user credentials per poll
const getCredentialsKey = (pollId: string) => `beaver_creds_${pollId}`;
// sessionStorage key for storing verified session state (survives locale changes)
const getSessionKey = (pollId: string) => `beaver_session_${pollId}`;


export function ResponseForm({ poll, existingResponse, locale, availabilityCounts, totalResponses = 0 }: ResponseFormProps) {
  const t = useTranslations('response');
  const tValidation = useTranslations('validation');
  const router = useRouter();
  const { getOrCreateToken } = useRespondentToken(poll.pollId);

  // Initialize question answers from existing response
  useEffect(() => {
    if (existingResponse?.questionAnswers && existingResponse.questionAnswers.length > 0) {
      const answers: Record<string, QuestionAnswer> = {};
      existingResponse.questionAnswers.forEach((a) => {
        answers[a.questionId] = a;
      });
      setQuestionAnswers(answers);
    }
  }, [existingResponse?.questionAnswers]);

  // Update a question answer
  const updateQuestionAnswer = (questionId: string, answer: Partial<QuestionAnswer>) => {
    setQuestionAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        ...answer,
        questionId, // Ensure questionId is always set correctly
      },
    }));
  };

  // Check if deadline has passed
  const isDeadlinePassed = useMemo(() => {
    if (!poll.deadline) return false;
    const deadlineDate = typeof poll.deadline === 'string' ? new Date(poll.deadline) : poll.deadline;
    return deadlineDate < new Date();
  }, [poll.deadline]);

  // Format deadline for display
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

  const [email, setEmail] = useState(existingResponse?.email || '');
  const [name, setName] = useState(existingResponse?.name || '');
  const [pin, setPin] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>(
    existingResponse?.selectedDates || []
  );
  const [notes, setNotes] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showPreviousNotice, setShowPreviousNotice] = useState(!!existingResponse);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [showSelectedDates, setShowSelectedDates] = useState(false);
  // Step 1: Email + Name + PIN, Step 2: Email verification (new users only), Step 3: Date selection
  const [step, setStep] = useState<1 | 2 | 3>(1);


  // Load saved credentials from localStorage and session state from sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Load credentials
      const saved = localStorage.getItem(getCredentialsKey(poll.pollId));
      if (saved) {
        const { email: savedEmail, name: savedName } = JSON.parse(saved);
        if (savedEmail && !existingResponse?.email) {
          setEmail(savedEmail);
        }
        if (savedName && !existingResponse?.name) {
          setName(savedName);
        }
      }

      // Restore session state (for locale switching)
      const sessionData = sessionStorage.getItem(getSessionKey(poll.pollId));
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.verified && session.email && session.name && session.pin) {
          setEmail(session.email);
          setName(session.name);
          setPin(session.pin);
          setSelectedDates(session.selectedDates || []);
          setNotes(session.notes || '');
          setIsExistingUser(session.isExistingUser || false);
          if (session.questionAnswers) {
            setQuestionAnswers(session.questionAnswers);
          }
          setStep(3);
        }
      }
    } catch (e) {
      console.error('Error loading saved state:', e);
    }
  }, [poll.pollId, existingResponse?.email, existingResponse?.name]);

  useEffect(() => {
    if (showPreviousNotice) {
      const timer = setTimeout(() => setShowPreviousNotice(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showPreviousNotice]);

  // Keep session in sync when on step 3 (for locale switching)
  useEffect(() => {
    if (step === 3 && typeof window !== 'undefined' && pin) {
      sessionStorage.setItem(getSessionKey(poll.pollId), JSON.stringify({
        verified: true,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        pin,
        selectedDates,
        notes,
        isExistingUser,
        questionAnswers,
      }));
    }
  }, [step, email, name, pin, selectedDates, notes, isExistingUser, poll.pollId, questionAnswers]);

  // Convert candidate dates with dateValue to Date objects for calendar
  const allowedDates = useMemo(() => {
    return poll.candidateDates
      .filter((d) => d.dateValue)
      .map((d) => parseISODate(d.dateValue!));
  }, [poll.candidateDates]);

  // Map dateValue to candidateId for quick lookup
  const dateValueToCandidateId = useMemo(() => {
    const map = new Map<string, string>();
    poll.candidateDates.forEach((d) => {
      if (d.dateValue) {
        map.set(d.dateValue, d.candidateId);
      }
    });
    return map;
  }, [poll.candidateDates]);

  // Map candidateId to dateValue for reverse lookup
  const candidateIdToDateValue = useMemo(() => {
    const map = new Map<string, string>();
    poll.candidateDates.forEach((d) => {
      if (d.dateValue) {
        map.set(d.candidateId, d.dateValue);
      }
    });
    return map;
  }, [poll.candidateDates]);

  // Convert selectedDates (candidateIds) to Date objects
  const selectedCalendarDates = useMemo(() => {
    return selectedDates
      .map((id) => candidateIdToDateValue.get(id))
      .filter((dv): dv is string => dv !== undefined)
      .map((dv) => parseISODate(dv));
  }, [selectedDates, candidateIdToDateValue]);

  // Convert availabilityCounts from candidateId to dateValue format for Calendar
  const calendarAvailabilityCounts = useMemo(() => {
    if (!availabilityCounts) return undefined;
    const dateValueCounts = new Map<string, number>();
    availabilityCounts.forEach((count, candidateId) => {
      const dateValue = candidateIdToDateValue.get(candidateId);
      if (dateValue) {
        dateValueCounts.set(dateValue, count);
      }
    });
    return dateValueCounts;
  }, [availabilityCounts, candidateIdToDateValue]);

  // Handle calendar date selection
  const handleCalendarDatesChange = (dates: Date[]) => {
    const newSelectedIds = dates
      .map((d) => {
        const dateValue = toISODateString(d);
        return dateValueToCandidateId.get(dateValue);
      })
      .filter((id): id is string => id !== undefined);
    setSelectedDates(newSelectedIds);
  };

  const toggleDate = (candidateId: string) => {
    setSelectedDates((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
    );
  };


  // Validate email format
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPinError(null);

    if (selectedDates.length === 0) {
      setError(t('noSelection'));
      return;
    }

    // Validate required questions
    const requiredQuestions = poll.questions?.filter((q) => q.required) || [];
    for (const q of requiredQuestions) {
      const answer = questionAnswers[q.questionId];
      if (!answer) {
        setError(locale === 'ja' ? '必須の質問に回答してください' : 'Please answer all required questions');
        return;
      }
      if (q.type === 'text' && !answer.textAnswer?.trim()) {
        setError(locale === 'ja' ? '必須の質問に回答してください' : 'Please answer all required questions');
        return;
      }
      if (q.type === 'multiple_choice') {
        const hasSelection = q.multiSelect
          ? (answer.selectedOptionIds && answer.selectedOptionIds.length > 0)
          : answer.selectedOptionId;
        if (!hasSelection) {
          setError(locale === 'ja' ? '必須の質問に回答してください' : 'Please answer all required questions');
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const respondentToken = getOrCreateToken(poll.pollId);

      // Convert questionAnswers record to array
      const answersArray = Object.values(questionAnswers).filter(
        (a) => a.textAnswer || a.selectedOptionId || (a.selectedOptionIds && a.selectedOptionIds.length > 0)
      );

      const response = await fetch(`/api/polls/${poll.pollId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          selectedDates,
          respondentToken,
          pin,
          notes: notes.trim() || undefined,
          questionAnswers: answersArray.length > 0 ? answersArray : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'PIN_MISMATCH') {
          setPinError(t('pinMismatch'));
          setStep(1);
          return;
        }
        throw new Error(data.message || data.error || 'Failed to submit response');
      }

      // Save credentials to localStorage for convenience
      try {
        localStorage.setItem(
          getCredentialsKey(poll.pollId),
          JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() })
        );
      } catch (e) {
        console.error('Error saving credentials:', e);
      }

      // Clear session after successful submission
      sessionStorage.removeItem(getSessionKey(poll.pollId));
      router.push(`/${locale}/poll/${poll.pollId}/confirmation`);
    } catch (err) {
      console.error('Error submitting response:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll is finalized
  if (poll.status === 'finalized' && poll.finalizedDate) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-status-all">{t('pollFinalized')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary mb-2">{t('finalizedDate')}</p>
            <div className="p-4 bg-status-all-bg border-2 border-status-all rounded-lg">
              <p className="text-lg font-semibold text-status-all">
                {poll.finalizedDate.label}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push(`/${locale}/poll/${poll.pollId}/results`)}
            >
              {t('viewResults')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Poll is closed
  if (poll.status === 'closed') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-status-most">{t('pollClosed')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary">{t('pollClosedMessage')}</p>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push(`/${locale}/poll/${poll.pollId}/results`)}
            >
              {t('viewResults')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Deadline has passed
  if (isDeadlinePassed) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-status-most">{t('pollClosed')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary">{t('deadlinePassed')}</p>
            <p className="text-sm text-text-muted mt-2">
              {t('deadline')}: {formatDeadline(poll.deadline)}
            </p>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push(`/${locale}/poll/${poll.pollId}/results`)}
            >
              {t('viewResults')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if we have calendar dates
  const hasCalendarDates = allowedDates.length > 0;

  // Handle continue from step 1 -> step 2 (or step 3 for existing users)
  const handleContinue = async () => {
    setError(null);
    setPinError(null);
    setEmailError(null);

    // Validate email
    if (!email.trim()) {
      setEmailError(tValidation('emailRequired'));
      return;
    }
    if (!isValidEmail(email.trim())) {
      setEmailError(t('emailInvalid'));
      return;
    }

    // Validate name
    if (!name.trim()) {
      setError(tValidation('nameRequired'));
      return;
    }

    // Validate PIN format
    if (!isValidPin(pin)) {
      setPinError(t('pinInvalid'));
      return;
    }

    setIsVerifying(true);

    try {
      // Verify credentials with server (email + PIN)
      const response = await fetch(`/api/polls/${poll.pollId}/verify-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          pin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'PIN_MISMATCH') {
          setPinError(t('pinMismatch'));
          return;
        }
        if (data.error === 'RATE_LIMITED') {
          setError(t('rateLimited', { minutes: data.remainingMinutes }));
          return;
        }
        throw new Error(data.message || data.error || 'Verification failed');
      }

      // If user is the poll creator, redirect to admin page
      if (data.isCreator && data.adminToken) {
        router.push(`/${locale}/poll/${poll.pollId}/admin/${data.adminToken}`);
        return;
      }

      if (data.isExistingUser && data.existingResponse) {
        // Existing user -- skip email verification, go to date selection
        setIsExistingUser(true);
        const dates = data.existingResponse.selectedDates || [];
        const userNotes = data.existingResponse.notes || '';
        const userName = data.existingResponse.name || name;
        setSelectedDates(dates);
        if (data.existingResponse.name) {
          setName(userName);
        }
        if (data.existingResponse.notes) {
          setNotes(userNotes);
        }
        // Restore question answers
        const existingAnswers = data.existingResponse.questionAnswers || [];
        const answersRecord: Record<string, QuestionAnswer> = {};
        existingAnswers.forEach((a: QuestionAnswer) => {
          answersRecord[a.questionId] = a;
        });
        setQuestionAnswers(answersRecord);
        setShowPreviousNotice(true);
        // Save session for locale switching
        sessionStorage.setItem(getSessionKey(poll.pollId), JSON.stringify({
          verified: true,
          email: email.trim().toLowerCase(),
          name: userName,
          pin,
          selectedDates: dates,
          notes: userNotes,
          isExistingUser: true,
          questionAnswers: answersRecord,
        }));
        setStep(3);
      } else {
        // New user -- need email verification
        setIsExistingUser(false);
        setSelectedDates([]);
        setNotes('');
        setQuestionAnswers({});
        setShowPreviousNotice(false);
        await sendVerificationCode();
        setStep(2);
      }
    } catch (err) {
      console.error('Error verifying credentials:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Send verification code
  const sendVerificationCode = async () => {
    setCodeError(null);
    setIsSendingCode(true);

    try {
      const response = await fetch(`/api/polls/${poll.pollId}/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          locale,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'EMAIL_RATE_LIMITED') {
          setCodeError(t('emailRateLimited', { minutes: data.remainingMinutes }));
          return;
        }
        throw new Error(data.message || data.error || 'Failed to send code');
      }

      // If existing user was detected during send-verification, skip to step 3
      if (data.isExistingUser) {
        setIsExistingUser(true);
        // Note: For existing users, their data will be fetched from verify-credentials
        // Clear any stale data
        setSelectedDates([]);
        setNotes('');
        setQuestionAnswers({});
        // Save session for locale switching
        sessionStorage.setItem(getSessionKey(poll.pollId), JSON.stringify({
          verified: true,
          email: email.trim().toLowerCase(),
          name: name.trim(),
          pin,
          selectedDates: [],
          notes: '',
          questionAnswers: {},
          isExistingUser: true,
        }));
        setStep(3);
        return;
      }
    } catch (err) {
      console.error('Error sending verification code:', err);
      setCodeError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsSendingCode(false);
    }
  };

  // Verify the email code
  const handleVerifyCode = async () => {
    setCodeError(null);

    if (!/^\d{6}$/.test(verificationCode)) {
      setCodeError(t('verificationCodeInvalid'));
      return;
    }

    setIsVerifyingCode(true);

    try {
      const response = await fetch(`/api/polls/${poll.pollId}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'VERIFICATION_CODE_MISMATCH') {
          setCodeError(t('verificationCodeMismatch'));
          return;
        }
        if (data.error === 'VERIFICATION_EXPIRED') {
          setCodeError(t('verificationCodeExpired'));
          return;
        }
        if (data.error === 'VERIFICATION_MAX_ATTEMPTS') {
          setCodeError(t('verificationMaxAttempts'));
          return;
        }
        throw new Error(data.message || data.error || 'Verification failed');
      }

      // Email verified -- go to date selection
      // Clear any previous data for new user
      setSelectedDates([]);
      setNotes('');
      setQuestionAnswers({});
      // Save session for locale switching
      sessionStorage.setItem(getSessionKey(poll.pollId), JSON.stringify({
        verified: true,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        pin,
        selectedDates: [],
        notes: '',
        questionAnswers: {},
        isExistingUser: false,
      }));
      setStep(3);
    } catch (err) {
      console.error('Error verifying code:', err);
      setCodeError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Step 3 calendar section for two-column layout
  const calendarSection = hasCalendarDates ? (
    <Card>
      <CardContent>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-text-secondary">
            {t('selectDates')}
          </label>

          {totalResponses > 0 && (
            <p className="text-xs text-text-muted mb-2">
              {t('availabilityHint', { count: totalResponses })}
            </p>
          )}
          <div className="border border-border rounded-lg p-4 bg-surface">
            <Calendar
              selectedDates={selectedCalendarDates}
              onDatesChange={handleCalendarDatesChange}
              allowedDates={allowedDates}
              locale={locale}
              availabilityCounts={calendarAvailabilityCounts}
              totalResponses={totalResponses}
            />
          </div>

          {/* Selected dates display - collapsible */}
          {selectedDates.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowSelectedDates(!showSelectedDates)}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showSelectedDates ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">
                  {locale === 'ja'
                    ? `選択した日程 (${selectedDates.length}件)`
                    : `Selected dates (${selectedDates.length})`}
                </span>
              </button>
              {showSelectedDates && (
                <div className="flex flex-wrap gap-2 mt-2 pl-6">
                  {selectedDates.map((id) => {
                    const date = poll.candidateDates.find((d) => d.candidateId === id);
                    return date ? (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-sm"
                      >
                        {date.label}
                        <button
                          type="button"
                          onClick={() => toggleDate(id)}
                          className="ml-1 hover:text-primary-700"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  ) : null;

  // Step 3 controls section for two-column layout
  const step3Controls = (
    <Card>
      <CardHeader>
        <CardTitle>{poll.title}</CardTitle>
        {poll.description && (
          <CardDescription>{poll.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-secondary">{t('step3Title')}</p>
            <button
              type="button"
              onClick={() => { setStep(1); setPin(''); setVerificationCode(''); }}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {t('backToCredentials')}
            </button>
          </div>

          <div className="p-3 bg-surface-secondary rounded-lg space-y-1 overflow-hidden">
            <p className="text-sm text-text-secondary break-all">
              {t('yourEmail')}: <span className="font-medium text-text-primary">{email}</span>
            </p>
            <p className="text-sm text-text-secondary">
              {t('yourName')}: <span className="font-medium text-text-primary">{name}</span>
            </p>
          </div>

          {/* Non-calendar fallback: checkbox list */}
          {!hasCalendarDates && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-secondary">
                {t('selectDates')}
              </label>
              <div className="space-y-2">
                {poll.candidateDates.map((date) => (
                  <label
                    key={date.candidateId}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all min-h-[56px] ${
                      selectedDates.includes(date.candidateId)
                        ? 'bg-primary-50 border-primary-500'
                        : 'hover:bg-surface-secondary hover:border-border-secondary border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDates.includes(date.candidateId)}
                      onChange={() => toggleDate(date.candidateId)}
                      className="w-6 h-6 rounded border-2 border-border text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-base font-medium text-text-primary">
                      {date.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Custom questions */}
          {poll.questions && poll.questions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary">
                {locale === 'ja' ? '追加の質問' : 'Additional Questions'}
              </h3>
              {poll.questions.map((q) => (
                <div key={q.questionId} className="space-y-2">
                  <label className="block text-sm font-medium text-text-primary">
                    {q.question}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {q.type === 'text' ? (
                    <textarea
                      value={questionAnswers[q.questionId]?.textAnswer || ''}
                      onChange={(e) => updateQuestionAnswer(q.questionId, { textAnswer: e.target.value })}
                      placeholder={locale === 'ja' ? '回答を入力...' : 'Enter your answer...'}
                      maxLength={1000}
                      rows={2}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                  ) : q.multiSelect ? (
                    // Multi-select: checkboxes
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted">
                        {locale === 'ja' ? '複数選択可' : 'Select all that apply'}
                      </p>
                      {q.options?.map((option) => {
                        const selectedIds = questionAnswers[q.questionId]?.selectedOptionIds || [];
                        const isSelected = selectedIds.includes(option.optionId);
                        return (
                          <label
                            key={option.optionId}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-primary-50 border-primary-500'
                                : 'hover:bg-surface-secondary border-border'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const currentIds = questionAnswers[q.questionId]?.selectedOptionIds || [];
                                const newIds = isSelected
                                  ? currentIds.filter((id) => id !== option.optionId)
                                  : [...currentIds, option.optionId];
                                updateQuestionAnswer(q.questionId, { selectedOptionIds: newIds });
                              }}
                              className="w-4 h-4 rounded text-primary-600 border-border focus:ring-primary-500"
                            />
                            <span className="text-sm text-text-primary">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    // Single-select: radio buttons
                    <div className="space-y-2">
                      {q.options?.map((option) => (
                        <label
                          key={option.optionId}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            questionAnswers[q.questionId]?.selectedOptionId === option.optionId
                              ? 'bg-primary-50 border-primary-500'
                              : 'hover:bg-surface-secondary border-border'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${q.questionId}`}
                            checked={questionAnswers[q.questionId]?.selectedOptionId === option.optionId}
                            onChange={() => updateQuestionAnswer(q.questionId, { selectedOptionId: option.optionId })}
                            className="w-4 h-4 text-primary-600 border-border focus:ring-primary-500"
                          />
                          <span className="text-sm text-text-primary">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Notes textarea */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">
              {t('notes')} <span className="text-text-muted font-normal">({t('optional')})</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="text-xs text-text-muted text-right">{notes.length}/500</p>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}

          {/* Fixed bottom action bar on mobile */}
          <div className="lg:relative lg:pb-0">
            <Button
              type="submit"
              className="w-full"
              isLoading={isSubmitting}
            >
              {isSubmitting
                ? t('submitting')
                : isExistingUser
                ? t('updateResponse')
                : t('submitResponse')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Card className={step === 3 ? 'hidden' : ''}>
        <CardHeader>
          <CardTitle>{poll.title}</CardTitle>
          {poll.description && (
            <CardDescription>{poll.description}</CardDescription>
          )}
          {poll.deadline && (
            <div className="mt-2 flex items-center gap-2 text-sm text-status-most">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{t('deadline')}: {formatDeadline(poll.deadline)}</span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {showPreviousNotice && (
            <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-sm text-primary-600">{t('previousResponse')}</p>
            </div>
          )}

          {/* Step 1: Email + Name + PIN */}
          {step === 1 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <p className="text-sm font-medium text-text-secondary">{t('step1Title')}</p>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  {t('yourEmail')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                  placeholder={t('yourEmailPlaceholder')}
                  className={`w-full px-4 py-2 border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    emailError ? 'border-red-500' : 'border-border'
                  }`}
                  required
                />
                {emailError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{emailError}</p>
                )}
              </div>

              <Input
                label={t('yourName')}
                placeholder={t('yourNamePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  {t('yourPin')} <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-text-muted">{t('pinDescription')}</p>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPin(value);
                    setPinError(null);
                  }}
                  placeholder="1234"
                  className={`w-32 px-4 py-2 text-center text-lg tracking-widest border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    pinError ? 'border-red-500' : 'border-border'
                  }`}
                  required
                />
                {pinError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{pinError}</p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
              )}

              <Button
                type="button"
                className="w-full"
                onClick={handleContinue}
                isLoading={isVerifying}
              >
                {isVerifying ? t('submitting') : t('continue')}
              </Button>
            </div>
          )}

          {/* Step 2: Email Verification (new users only) */}
          {step === 2 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-secondary">{t('step2Title')}</p>
                <button
                  type="button"
                  onClick={() => { setStep(1); setPin(''); setVerificationCode(''); setCodeError(null); }}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  {t('backToEmail')}
                </button>
              </div>

              <div className="p-3 bg-surface-secondary rounded-lg overflow-hidden">
                <p className="text-sm text-text-secondary break-all">
                  {t('yourEmail')}: <span className="font-medium text-text-primary">{email}</span>
                </p>
              </div>

              <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                <p className="text-sm text-primary-600">{t('verificationSent')}</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  {t('verificationCode')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerificationCode(value);
                    setCodeError(null);
                  }}
                  placeholder={t('verificationCodePlaceholder')}
                  className={`w-full max-w-[12rem] px-4 py-2 text-center text-lg tracking-widest border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    codeError ? 'border-red-500' : 'border-border'
                  }`}
                  required
                />
                {codeError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{codeError}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  className="w-full sm:flex-1"
                  onClick={handleVerifyCode}
                  isLoading={isVerifyingCode}
                >
                  {isVerifyingCode ? t('verifying') : t('verifyEmail')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={sendVerificationCode}
                  disabled={isSendingCode}
                >
                  {isSendingCode ? t('sendingCode') : t('resendCode')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Two-column layout for date selection */}
      {step === 3 && (
        <>
          {showPreviousNotice && (
            <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg max-w-2xl mx-auto lg:max-w-6xl">
              <p className="text-sm text-primary-600">{t('previousResponse')}</p>
            </div>
          )}
          {calendarSection ? (
            <TwoColumnLayout
              left={calendarSection}
              right={step3Controls}
            />
          ) : (
            <div className="max-w-2xl mx-auto">
              {step3Controls}
            </div>
          )}
        </>
      )}

    </>
  );
}
