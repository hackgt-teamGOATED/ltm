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
