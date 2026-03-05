import { createNavigation } from 'next-intl/navigation';

export const locales = ['en', 'zh-CN'] as const;
export const defaultLocale = 'en' as const;

export const { Link, redirect, usePathname, useRouter } =
  createNavigation({
    locales,
    defaultLocale,
    localePrefix: 'as-needed',
  });
