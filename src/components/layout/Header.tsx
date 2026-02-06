import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  locale: string;
}

export function Header({ locale }: HeaderProps) {
  const t = useTranslations('header');

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href={`/${locale}`}
          className="flex flex-col hover:opacity-80 transition-opacity"
        >
          <span className="text-xl font-bold text-primary-600">{t('title')}</span>
          <span className="text-xs text-text-secondary">{t('subtitle')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
