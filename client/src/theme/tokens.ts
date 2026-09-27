// Visual system (PLAN.md §7.3): one Messenger-style skin plus Heirloom gold for everything the layer adds.
export const colors = {
  bubbleSentTop: '#0A7CFF',
  bubbleSentBottom: '#8B3DFF',
  bubbleReceived: '#EFEFF1',
  textOnSent: '#FFFFFF',
  textPrimary: '#0B0B0C',
  textSecondary: '#65676B',
  background: '#FFFFFF',
  hairline: '#E4E6EB',
  surface: '#F5F6F8',
  heirloom: '#C9922E',
  heirloomTint: '#FBF3E4',
  /** Selected word / matching translation words: must read clearly on the grey received bubble. */
  heirloomHighlight: '#F5DDA8',
  mastered: '#2E9E6B',
  fading: '#D9822B',
  danger: '#D93025',
  overlay: 'rgba(0,0,0,0.35)',
} as const;

export const radius = { bubble: 18, tail: 4, card: 14, pill: 999 } as const;
export const space = { inGroup: 2, betweenGroups: 10, gutter: 12 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  urdu: 'NotoNastaliqUrdu_400Regular',
  devanagari: 'NotoSansDevanagari_400Regular',
} as const;

/** Stable avatar colors per persona. */
export const avatarColors = ['#0A7CFF', '#E4405F', '#2E9E6B', '#8B3DFF', '#D9822B', '#C9922E'];
