import en from './en.json';
import zhCN from './zh-CN.json';

export type Messages = typeof en;

export const messages: Record<string, Messages> = {
  'en': en,
  'zh-CN': zhCN,
};

export type Locale = keyof typeof messages;

export const defaultLocale: Locale = 'en';

export function getMessages(locale: Locale = defaultLocale): Messages {
  return messages[locale] || messages[defaultLocale];
}

export const locales: Locale[] = Object.keys(messages) as Locale[];
