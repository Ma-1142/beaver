import { HomePage } from '@/components/home/HomePage';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return <HomePage locale={locale} />;
}
