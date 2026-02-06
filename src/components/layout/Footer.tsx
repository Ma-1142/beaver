import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="bg-surface-secondary border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <p className="text-center text-sm text-text-muted">
          {t('copyright')}
        </p>
      </div>
    </footer>
  );
}
