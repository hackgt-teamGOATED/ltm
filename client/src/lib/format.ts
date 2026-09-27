import type { Message } from '../api/types';

/** Chat-list style time: "9:41 PM" today, "Mon" this week, else "Sep 3". */
export function shortTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** What a viewer reads for a message: their translation if there is one, else the original. */
export function textFor(m: Message, viewerLang: string): string {
  if (m.originalLanguage === viewerLang) return m.originalText ?? '';
  return m.translations.find((t) => t.language === viewerLang)?.text ?? m.originalText ?? '';
}

export function preview(m: Message | undefined, viewerLang: string, meId: string): string {
  if (!m) return 'Say hello';
  const who = m.senderId === meId ? 'You: ' : '';
  if (m.kind === 'voice' && !m.originalText) return `${who}🎤 Voice note`;
  const body = textFor(m, viewerLang);
  return `${who}${m.kind === 'voice' ? '🎤 ' : ''}${body}`;
}

/** Centered divider in a conversation: "Today 9:41 PM", "Yesterday 9:41 PM", "Mon 9:41 PM", "Sep 3, 9:41 PM". */
export function dividerLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days < 7) return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

/** A divider goes above a message when it starts the thread or follows a gap of more than an hour. */
export const needsDivider = (prevIso: string | undefined, iso: string): boolean =>
  !prevIso || new Date(iso).getTime() - new Date(prevIso).getTime() > 3_600_000;
