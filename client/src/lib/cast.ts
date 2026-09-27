// The demo cast (PLAN.md §1.2). Other v0 profiles stay in the database but are hidden from the picker.
import type { Lang } from '../api/types';

const id = (suffix: string) => `00000000-0000-0000-0000-${suffix.padStart(12, '0')}`;

export const CAST = [
  { slug: 'arjun', id: id('1'), name: 'Arjun', language: 'en', blurb: 'Learning Spanish and Urdu' },
  { slug: 'abuela', id: id('3'), name: 'Abuela', language: 'es', blurb: 'Habla español' },
  { slug: 'zara', id: id('5'), name: 'Zara', language: 'ur', blurb: 'اردو بولتی ہیں' },
] as const;

export const castBySlug = (slug: string | null | undefined) => CAST.find((c) => c.slug === slug?.toLowerCase());
export const castById = (pid: string | null | undefined) => CAST.find((c) => c.id === pid);

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  ur: 'Urdu',
  hi: 'Hindi',
};
export const LEARNABLE: Lang[] = ['es', 'ur', 'hi', 'en'];

export const isRtl = (lang: string | null | undefined) => lang === 'ur' || lang === 'ar';
