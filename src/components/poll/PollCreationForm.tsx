'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, Calendar, formatDateLabel, toISODateString } from '@/components/ui';
import { QuestionEditor, QuestionData } from './QuestionEditor';

interface PollCreationFormProps {
  locale: string;
}

interface CreatedPoll {
  pollId: string;
  adminToken: string;
}

export function PollCreationForm({ locale }: PollCreationFormProps) {
  const t = useTranslations('createPoll');
  const tResponse = useTranslations('response');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [deadline, setDeadline] = useState<string>(''); // datetime-local format
  const [creatorEmail, setCreatorEmail] = useState('');
  const [creatorPin, setCreatorPin] = useState('');
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<1 | 2>(1); // 1 = form, 2 = email verification
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [codeError, setCodeError] = useState<string | null>(null);
  const [createdPoll, setCreatedPoll] = useState<CreatedPoll | null>(null);
  const [copiedLink, setCopiedLink] = useState<'responder' | 'admin' | null>(null);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!title.trim()) {
      newErrors.title = tValidation('titleRequired');
    } else if (title.length > 100) {
      newErrors.title = tValidation('titleTooLong');
    }

    if (description.length > 500) {
      newErrors.description = tValidation('descriptionTooLong');
    }

    if (selectedDates.length < 2) {
      newErrors.dates = tValidation('minDates');
    }

    if (!creatorEmail.trim()) {
      newErrors.creatorEmail = tValidation('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creatorEmail)) {
      newErrors.creatorEmail = tValidation('emailInvalid');
    }

    if (!creatorPin || !/^\d{4}$/.test(creatorPin)) {
      newErrors.creatorPin = tValidation('pinRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Send verification code to email
  const sendVerificationCode = async () => {
    setCodeError(null);
    setIsSendingCode(true);

    try {
      const response = await fetch('/api/creator-verification/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: creatorEmail.trim().toLowerCase(),
          locale,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'EMAIL_RATE_LIMITED') {
          setCodeError(tResponse('emailRateLimited', { minutes: data.remainingMinutes }));
          return false;
        }
        throw new Error(data.message || data.error || 'Failed to send code');
      }

      return true;
    } catch (err) {
      console.error('Error sending verification code:', err);
      setCodeError(err instanceof Error ? err.message : 'Failed to send code');
      return false;
    } finally {
      setIsSendingCode(false);
    }
  };

  // Verify the email code - returns the token if successful
  const verifyCode = async (): Promise<string | null> => {
    setCodeError(null);

    if (!/^\d{6}$/.test(verificationCode)) {
      setCodeError(tResponse('verificationCodeInvalid'));
      return null;
    }

    setIsVerifying(true);

    try {
      const response = await fetch('/api/creator-verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: creatorEmail.trim().toLowerCase(),
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'VERIFICATION_CODE_MISMATCH') {
          setCodeError(tResponse('verificationCodeMismatch'));
          return null;
        }
        if (data.error === 'VERIFICATION_EXPIRED') {
          setCodeError(tResponse('verificationCodeExpired'));
          return null;
        }
        if (data.error === 'VERIFICATION_MAX_ATTEMPTS') {
          setCodeError(tResponse('verificationMaxAttempts'));
          return null;
        }
        throw new Error(data.message || data.error || 'Verification failed');
      }

      // Return the verified token
      return data.verifiedToken || null;
    } catch (err) {
      console.error('Error verifying code:', err);
      setCodeError(err instanceof Error ? err.message : 'Verification failed');
      return null;
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle step 1: Validate and send verification code
  const handleContinueToVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const sent = await sendVerificationCode();
    if (sent) {
      setStep(2);
    }
  };

  // Handle step 2: Verify code and create poll
  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = await verifyCode();
    if (!token) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          candidateDates: selectedDates.map((date) => ({
            label: formatDateLabel(date, locale),
            dateValue: toISODateString(date),
          })),
          deadline: deadline ? new Date(deadline).toISOString() : null,
          creatorEmail: creatorEmail.trim(),
          creatorPin: creatorPin,
          verifiedToken: token,
          questions: questions.filter(q => q.question.trim() !== '').map(q => ({
            type: q.type,
            question: q.question,
            required: q.required,
            multiSelect: q.multiSelect,
            options: q.options?.map(o => typeof o === 'string' ? o : o.label),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'EMAIL_NOT_VERIFIED') {
          setCodeError(tResponse('verificationCodeExpired'));
          return;
        }
        throw new Error('Failed to create poll');
      }

      setCreatedPoll({
        pollId: data.pollId,
        adminToken: data.adminToken,
      });
    } catch (error) {
      console.error('Error creating poll:', error);
      setErrors({ submit: 'Failed to create poll. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  const copyToClipboard = async (text: string, type: 'responder' | 'admin') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(type);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (createdPoll) {
    const baseUrl = getBaseUrl();
    const responderUrl = `${baseUrl}/${locale}/poll/${createdPoll.pollId}`;
    const adminUrl = `${baseUrl}/${locale}/poll/${createdPoll.pollId}/admin/${createdPoll.adminToken}`;

    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-status-all">{t('success')}</CardTitle>
            <CardDescription>{t('shareLinks')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                {t('responderLink')}
              </label>
              <p className="text-xs text-text-muted mb-2">{t('responderLinkDescription')}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={responderUrl}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded-lg bg-surface-secondary text-text-primary truncate"
                />
                <Button
                  onClick={() => copyToClipboard(responderUrl, 'responder')}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto shrink-0"
                >
                  {copiedLink === 'responder' ? tCommon('copied') : tCommon('copy')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                {t('adminLink')}
              </label>
              <p className="text-xs text-text-muted mb-2">{t('adminLinkDescription')}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={adminUrl}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded-lg bg-surface-secondary text-text-primary truncate"
                />
                <Button
                  onClick={() => copyToClipboard(adminUrl, 'admin')}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto shrink-0"
                >
                  {copiedLink === 'admin' ? tCommon('copied') : tCommon('copy')}
                </Button>
              </div>
            </div>

            {/* Show selected dates */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                {t('candidateDates')}
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedDates.map((date) => (
                  <span
                    key={date.toISOString()}
                    className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-sm"
                  >
                    {formatDateLabel(date, locale)}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Email verification
  if (step === 2) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('verifyEmailTitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyAndCreate} className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-secondary">{tResponse('step2Title')}</p>
                <button
                  type="button"
                  onClick={() => { setStep(1); setVerificationCode(''); setCodeError(null); }}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  {tCommon('back')}
                </button>
              </div>

              <div className="p-3 bg-surface-secondary rounded-lg overflow-hidden">
                <p className="text-sm text-text-secondary break-all">
                  {t('creatorEmail')}: <span className="font-medium text-text-primary">{creatorEmail}</span>
                </p>
              </div>

              <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                <p className="text-sm text-primary-600">{tResponse('verificationSent')}</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  {tResponse('verificationCode')} <span className="text-red-500">*</span>
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
                  placeholder={tResponse('verificationCodePlaceholder')}
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
                  type="submit"
                  className="w-full sm:flex-1"
                  isLoading={isVerifying || isSubmitting}
                >
                  {isVerifying ? tResponse('verifying') : isSubmitting ? t('creating') : t('createButton')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={sendVerificationCode}
                  disabled={isSendingCode}
                >
                  {isSendingCode ? tResponse('sendingCode') : tResponse('resendCode')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: Poll creation form
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleContinueToVerification} className="space-y-6">
            <Input
              label={t('pollTitle')}
              placeholder={t('pollTitlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
            />

            <Textarea
              label={t('pollDescription')}
              placeholder={t('pollDescriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              rows={3}
            />

            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-secondary">
                {t('candidateDates')}
              </label>
              <p className="text-sm text-text-muted">
                {t('calendarInstruction')}
              </p>
              {errors.dates && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.dates}</p>
              )}

              <div className="border border-border rounded-lg p-4 bg-surface">
                <Calendar
                  selectedDates={selectedDates}
                  onDatesChange={setSelectedDates}
                  locale={locale}
                />
              </div>

              {/* Selected dates display */}
              {selectedDates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-text-secondary">
                    {t('selectedDatesLabel')}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDates.map((date) => (
                      <span
                        key={date.toISOString()}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-sm"
                      >
                        {formatDateLabel(date, locale)}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDates(selectedDates.filter((d) => d.getTime() !== date.getTime()))
                          }
                          className="ml-1 hover:text-primary-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                {t('deadline')}
              </label>
              <p className="text-sm text-text-muted">
                {t('deadlineDescription')}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full sm:w-auto px-3 py-2 border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {deadline && (
                  <button
                    type="button"
                    onClick={() => setDeadline('')}
                    className="text-sm text-text-muted hover:text-text-secondary"
                  >
                    {t('noDeadline')}
                  </button>
                )}
              </div>
            </div>

            {/* Additional Questions */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {locale === 'ja' ? '追加質問（任意）' : 'Additional Questions (optional)'}
                </label>
                <p className="text-sm text-text-muted mt-1">
                  {locale === 'ja'
                    ? '参加者に回答してもらう追加の質問を設定できます'
                    : 'Add additional questions for participants to answer'}
                </p>
              </div>
              <QuestionEditor
                questions={questions}
                onChange={setQuestions}
                locale={locale}
              />
            </div>

            {/* Creator Credentials */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {t('creatorCredentials')}
                </label>
                <p className="text-sm text-text-muted mt-1">
                  {t('creatorCredentialsDescription')}
                </p>
              </div>

              <Input
                label={t('creatorEmail')}
                type="email"
                placeholder={t('creatorEmailPlaceholder')}
                value={creatorEmail}
                onChange={(e) => setCreatorEmail(e.target.value)}
                error={errors.creatorEmail}
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  {t('creatorPin')}
                </label>
                <p className="text-sm text-text-muted">
                  {t('creatorPinDescription')}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={creatorPin}
                  onChange={(e) => setCreatorPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  className={`w-32 px-3 py-2 border rounded-lg bg-surface text-text-primary text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.creatorPin ? 'border-red-500' : 'border-border'
                  }`}
                />
                {errors.creatorPin && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.creatorPin}</p>
                )}
              </div>
            </div>

            {errors.submit && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{errors.submit}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              isLoading={isSendingCode}
            >
              {isSendingCode ? tResponse('sendingCode') : t('continueToVerification')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
