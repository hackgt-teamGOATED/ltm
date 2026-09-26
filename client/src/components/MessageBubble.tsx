import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';
import type { Message } from '../api/types';
import { isRtl } from '../lib/cast';
import { colors, fonts, radius, space } from '../theme/tokens';

export interface GroupPos {
  first: boolean;
  last: boolean;
}

/** Script-aware text style: Nastaliq for Urdu (tall line height, right-to-left), Devanagari for Hindi. */
export function scriptStyle(lang: string | null | undefined, size = 16): TextStyle {
  if (lang === 'ur') {
    return { fontFamily: fonts.urdu, fontSize: size, lineHeight: size * 2.0, writingDirection: 'rtl', textAlign: 'right' };
  }
  if (lang === 'hi') return { fontFamily: fonts.devanagari, fontSize: size, lineHeight: size * 1.5 };
  return { fontFamily: fonts.regular, fontSize: size, lineHeight: size * 1.35 };
}

interface BubbleProps {
  mine: boolean;
  pos: GroupPos;
  children: ReactNode;
  /** Gold border when Heirloom annotates this bubble. */
  heirloom?: boolean;
  footer?: ReactNode;
}

/** Bubble shell: gradient when sent, grey when received, 18px radius with a 4px tail corner on the group's last bubble. */
export function Bubble({ mine, pos, children, heirloom, footer }: BubbleProps) {
  // The sender's side is squared off where bubbles join and at the tail (bottom of the group's last bubble).
  const corners = mine
    ? { borderTopRightRadius: pos.first ? radius.bubble : radius.tail, borderBottomRightRadius: radius.tail }
    : { borderTopLeftRadius: pos.first ? radius.bubble : radius.tail, borderBottomLeftRadius: radius.tail };
  const shape = [styles.bubble, corners, heirloom && styles.heirloom];
  return (
    <View
      style={[
        styles.row,
        { justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: pos.first ? space.betweenGroups : space.inGroup },
      ]}
    >
      <View style={{ maxWidth: '80%' }}>
        {mine ? (
          <LinearGradient colors={[colors.bubbleSentTop, colors.bubbleSentBottom]} style={shape}>
            {children}
          </LinearGradient>
        ) : (
          <View style={[shape, { backgroundColor: colors.bubbleReceived }]}>{children}</View>
        )}
        {footer}
      </View>
    </View>
  );
}

/** Plain (no Heirloom) rendering: sent shows what I wrote; received shows my translation, original on request. */
export function plainText(m: Message, viewerLang: string, mine: boolean) {
  const original = m.originalText ?? '';
  const translation = m.translations.find((t) => t.language === viewerLang)?.text ?? null;
  if (mine || m.originalLanguage === viewerLang) return { main: original, mainLang: m.originalLanguage, secondary: null };
  return {
    main: translation ?? original,
    mainLang: translation ? viewerLang : m.originalLanguage,
    secondary: translation ? original : null,
  };
}

export function StatusLine({ m, mine }: { m: Message; mine: boolean }) {
  if (m.status === 'ready') return null;
  const color = mine ? 'rgba(255,255,255,0.8)' : colors.textSecondary;
  return (
    <Text style={[styles.status, { color }]}>
      {m.status === 'processing' ? (m.kind === 'voice' ? 'Transcribing…' : 'Translating…') : "Couldn't translate"}
    </Text>
  );
}

export const bubbleText = (mine: boolean, lang: string | null | undefined): TextStyle[] => [
  scriptStyle(lang),
  { color: mine ? colors.textOnSent : colors.textPrimary },
  isRtl(lang) ? { writingDirection: 'rtl', textAlign: 'right' } : {},
];

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: space.gutter },
  bubble: { borderRadius: radius.bubble, paddingHorizontal: 12, paddingVertical: 8 },
  heirloom: { borderWidth: 1.5, borderColor: colors.heirloom },
  status: { marginTop: 2, fontSize: 12, fontFamily: fonts.regular },
});
