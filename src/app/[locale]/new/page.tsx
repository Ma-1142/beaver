import { PollCreationForm } from '@/components/poll/PollCreationForm';

export default async function NewPollPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <PollCreationForm locale={locale} />;
}
