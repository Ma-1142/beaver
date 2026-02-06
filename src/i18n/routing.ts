import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ja'],
  defaultLocale: 'ja',
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
