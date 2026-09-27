// Visual system (PLAN.md §7.3): one Messenger-style skin plus Heirloom gold for everything the layer adds.
export const colors = {
  bubbleSentTop: '#0A7CFF',
  bubbleSentBottom: '#8B3DFF',
  bubbleReceived: '#EFEFF1',
  textOnSent: '#FFFFFF',
  textPrimary: '#0B0B0C',
  textSecondary: '#65676B',
  textTertiary: '#9A9AA0',
  background: '#FFFFFF',
  hairline: '#E8E8EC',
  surface: '#F5F6F8',
  heirloom: '#C9922E',
  heirloomTint: '#FBF3E4',
  /** Text on the gold tint (pills, stage-up card). */
  heirloomDeep: '#8A5A12',
  /** Selected word / matching translation words: must read clearly on the grey received bubble. */
  heirloomHighlight: '#F5DDA8',
  /** Karaoke: the word being spoken right now. Lighter than the selection so the two never read alike. */
  heirloomKaraoke: '#FFE9B8',
  mastered: '#2E9E6B',
  fading: '#D9822B',
  danger: '#D93025',
  overlay: 'rgba(0,0,0,0.35)',
  divider: 'rgba(0,0,0,0.08)',
} as const;

export const radius = { bubble: 20, tail: 4, card: 16, input: 22, sheet: 24, pill: 999 } as const;
/** 4pt grid: 4, 8, 12, 16, 20, 24, 32. `inGroup` is the one deliberate 2px (joined bubbles). */
export const space = { inGroup: 2, betweenGroups: 12, gutter: 12, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32 } as const;

/** Type scale (Inter). Weights 400/500/600 only; headings use letterSpacing -0.3; stats use tabular numbers. */
export const type = {
  caption: 12,
  meta: 13,
  secondary: 15,
  body: 17,
  title: 20,
  display: 28,
  headingSpacing: -0.3,
} as const;
export const tabular: { fontVariant: ('tabular-nums')[] } = { fontVariant: ['tabular-nums'] };

/** The one soft shadow, for floating cards and sheets. Everything else uses hairlines. */
export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
} as const;

/** Every tappable dims to this while pressed. */
export const PRESSED_OPACITY = 0.7;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  urdu: 'NotoNastaliqUrdu_400Regular',
  devanagari: 'NotoSansDevanagari_400Regular',
} as const;

/** Stable avatar colors per persona. */
export const avatarColors = ['#0A7CFF', '#E4405F', '#2E9E6B', '#8B3DFF', '#D9822B', '#C9922E'];
