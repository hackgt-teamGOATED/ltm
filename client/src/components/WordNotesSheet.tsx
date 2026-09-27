import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/rest';
import type { WordNotes } from '../api/types';
import { colors, fonts } from '../theme/tokens';
import { scriptStyle } from './MessageBubble';

interface Props {
  lang: string;
  lemma: string;
  /** What to show as the title (the surface form or the whole phrase). */
  title: string;
  romanization?: string;
  viewerLang: string;
  profileId: string;
}

/** "View more" (PLAN.md §6.3, US-4): usage, grammar, culture, examples; cached on the server. */
export function WordNotesSheet({ lang, lemma, title, romanization, viewerLang, profileId }: Props) {
  const [notes, setNotes] = useState<WordNotes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .wordNotes(lang, lemma, viewerLang, profileId)
      .then((n) => live && setNotes(n))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [lang, lemma, viewerLang, profileId]);

  return (
    <View style={styles.wrap}>
      <Text style={[scriptStyle(lang, 26), styles.title]}>{title}</Text>
      {romanization ? <Text style={styles.roman}>{romanization}</Text> : null}
      {!notes && !error && <ActivityIndicator color={colors.heirloom} style={{ marginVertical: 24 }} />}
      {error && <Text style={styles.error}>Couldn't load notes: {error}</Text>}
      {notes && (
        <>
          {notes.isIdiom && <Text style={styles.badge}>✦ Idiom</Text>}
          <Section label="How it's used" body={notes.usage} />
          <Section label="Grammar" body={notes.grammar} />
          {notes.culture ? <Section label="Culture" body={notes.culture} /> : null}
          {notes.yourExamples.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>From your chats</Text>
              {notes.yourExamples.map((ex) => (
                <Example key={`y${ex.text}`} lang={lang} {...ex} />
              ))}
            </View>
          )}
          {notes.examples.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Examples</Text>
              {notes.examples.map((ex) => (
                <Example key={`e${ex.text}`} lang={lang} {...ex} />
              ))}
            </View>
          )}
          <Text style={styles.foot}>AI-generated notes. They may need checking by a native speaker.</Text>
        </>
      )}
    </View>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  if (!body) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

function Example({ lang, text, translation }: { lang: string; text: string; translation: string }) {
  return (
    <View style={styles.example}>
      <Text style={[scriptStyle(lang), { color: colors.textPrimary }]}>{text}</Text>
      {translation ? <Text style={styles.exTr}>{translation}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 12 },
  title: { color: colors.textPrimary },
  roman: { marginTop: 2, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 15 },
  badge: { marginTop: 8, color: colors.heirloom, fontFamily: fonts.semibold },
  section: { marginTop: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.heirloom, textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { marginTop: 4, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textPrimary },
  example: { marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.heirloomTint },
  exTr: { marginTop: 2, fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  error: { marginTop: 16, color: colors.danger, fontFamily: fonts.regular },
  foot: { marginTop: 20, fontSize: 12, color: colors.textSecondary, fontFamily: fonts.regular },
});
