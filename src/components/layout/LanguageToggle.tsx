'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLocale = () => {
    const newLocale = locale === 'ja' ? 'en' : 'ja';
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <button
      onClick={toggleLocale}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
        'border border-border hover:bg-surface-secondary',
        'text-text-secondary',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-background'
      )}
      aria-label={locale === 'ja' ? 'Switch to English' : '日本語に切り替え'}
    >
      {locale === 'ja' ? 'EN' : '日本語'}
    </button>
  );
}
