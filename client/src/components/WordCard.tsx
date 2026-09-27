import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MessageAnalysis } from '../api/types';
import { play, usePlayer } from '../audio/player';
import { useSheet } from '../store/sheet';
import { colors, fonts, radius } from '../theme/tokens';
import { scriptStyle } from './MessageBubble';
import { TranslationText } from './TranslationText';
import { WordNotesSheet } from './WordNotesSheet';

interface Props {
  analysis: MessageAnalysis;
  tokenIndex: number;
  lang: string;
  viewerLang: string;
  profileId: string;
  /** Original voice-note audio, for "Hear it" (plays just this word via Whisper timestamps). */
  audioUrl: string | null;
  onSelect: (i: number) => void;
  onClose: () => void;
  /** Challenge mode: four options first; the card opens after the answer. */
  guess?: { options: string[]; onAnswer: (correct: boolean) => void };
  /** "Hear it" was used (logs audio_play). */
  onHear?: () => void;
}

/** The card under a bubble when a word is tapped (PLAN.md §7.5, US-3). */
export function WordCard(props: Props) {
  const { analysis, tokenIndex, lang, guess, onClose } = props;
  const [answer, setAnswer] = useState<{ choice: string; correct: boolean } | null>(null);
  const t = analysis.tokens[tokenIndex];
  if (!t) return null;
  if (guess && !answer) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>✦ Do you know this one?</Text>
            <Text style={[scriptStyle(lang, 20), styles.word]}>{t.surface}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.iconBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.options}>
          {guess.options.map((o) => (
            <Pressable
              key={o}
              accessibilityRole="button"
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.heirloomTint }]}
              onPress={() => {
                const correct = o.trim().toLowerCase() === t.gloss.trim().toLowerCase();
                setAnswer({ choice: o, correct });
                guess.onAnswer(correct);
              }}
            >
              <Text style={styles.optionText}>{o}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  return <WordDetails {...props} result={answer} />;
}

function WordDetails({
  analysis,
  tokenIndex,
  lang,
  viewerLang,
  profileId,
  audioUrl,
  onSelect,
  onClose,
  onHear,
  result,
}: Props & { result: { choice: string; correct: boolean } | null }) {
  const openSheet = useSheet((s) => s.open);
  const t = analysis.tokens[tokenIndex];
  const phrase = t?.phraseId ? analysis.phrases.find((p) => p.id === t.phraseId) : undefined;
  const hearKey = `${analysis.messageId}:word:${tokenIndex}`;
  const playing = usePlayer((s) => s.key === hearKey && s.playing);
  if (!t) return null;

  const phraseText = phrase
    ? phrase.tokenIndices
        .map((i) => analysis.tokens[i])
        .filter(Boolean)
        .map((x, k) => (k === 0 ? x.surface : x.pre + x.surface))
        .join('')
    : null;
  const canHear = Boolean(audioUrl && t.start !== undefined && t.end !== undefined);

  const viewMore = () =>
    openSheet(
      <WordNotesSheet
        lang={lang}
        lemma={phrase && phraseText ? phraseText.toLocaleLowerCase() : t.lemma}
        title={phraseText ?? t.surface}
        romanization={phrase ? undefined : t.romanization}
        viewerLang={viewerLang}
        profileId={profileId}
      />,
    );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[scriptStyle(lang, 20), styles.word]}>{t.surface}</Text>
          {t.romanization ? <Text style={styles.roman}>{t.romanization}</Text> : null}
          <Text style={styles.meaning}>
            {t.gloss}
            {t.pos ? <Text style={styles.pos}> · {t.pos.toLowerCase()}</Text> : null}
          </Text>
        </View>
        {canHear && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hear it"
            hitSlop={8}
            style={styles.iconBtn}
            onPress={() => {
              onHear?.();
              void play(hearKey, audioUrl as string, t.start, t.end);
            }}
          >
            <Ionicons name={playing ? 'volume-high' : 'volume-medium-outline'} size={22} color={colors.heirloom} />
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.iconBtn} onPress={onClose}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {result && (
        <Text style={[styles.result, { color: result.correct ? colors.mastered : colors.fading }]}>
          {result.correct ? '✓ You got it.' : `Not quite. It means "${t.gloss}".`}
        </Text>
      )}
      <View style={styles.section}>
        <TranslationText
          analysis={analysis}
          viewerLang={viewerLang}
          selected={tokenIndex}
          onPressToken={onSelect}
          onSent={false}
          style={{ fontSize: 15 }}
        />
        {t.grammar ? <Text style={styles.grammar}>{t.grammar}</Text> : null}
      </View>

      <View style={[styles.section, styles.divider]}>
          {phrase && (
            <>
              <Text style={styles.label}>{phrase.isIdiom ? '✦ Idiom' : 'Phrase'}</Text>
              <Text style={[scriptStyle(lang, 15), { color: colors.textPrimary }]}>{phraseText}</Text>
              <Text style={styles.body}>{phrase.meaning}</Text>
              {phrase.culture ? <Text style={styles.culture}>{phrase.culture}</Text> : null}
            </>
          )}
          <Pressable onPress={viewMore} accessibilityRole="button" hitSlop={10} style={styles.viewMore}>
            <Text style={styles.viewMoreText}>View more</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.heirloom} />
          </Pressable>
      </View>
      {analysis.needsNativeCheck && <Text style={styles.check}>AI annotation, not yet checked by a native speaker</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 6,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.heirloom,
    backgroundColor: colors.background,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  word: { color: colors.textPrimary },
  roman: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 14 },
  meaning: { marginTop: 2, color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15 },
  pos: { color: colors.textSecondary, fontFamily: fonts.regular },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 10 },
  divider: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  grammar: { marginTop: 6, fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  label: { fontSize: 12, fontFamily: fonts.semibold, color: colors.heirloom, textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { marginTop: 2, fontSize: 14, fontFamily: fonts.regular, color: colors.textPrimary },
  culture: { marginTop: 6, fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, fontStyle: 'italic' },
  viewMore: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 24 },
  viewMoreText: { color: colors.heirloom, fontFamily: fonts.semibold, fontSize: 14 },
  check: { marginTop: 8, fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary },
  options: { marginTop: 10, gap: 8 },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  optionText: { fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary },
  result: { marginTop: 8, fontSize: 14, fontFamily: fonts.semibold },
});
