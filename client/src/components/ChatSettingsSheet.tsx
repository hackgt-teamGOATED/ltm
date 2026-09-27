import type { Stage } from '@heirloom/learner';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '../api/rest';
import type { Lang, ThreadSettings } from '../api/types';
import { LANGUAGE_NAMES, LEARNABLE } from '../lib/cast';
import { STAGE_LABEL } from '../learning/useLanguageView';
import { useThreads } from '../store/threads';
import { colors, fonts, radius } from '../theme/tokens';

interface Props {
  threadId: string;
  profileId: string;
  myLang: string;
  otherName: string;
  /** The other person's language: the sensible default for "I'm learning". */
  suggestedLang: string;
  stage: Stage;
  fadePct: number;
}

/** Per-chat Heirloom settings (PLAN.md §7.1, US-2): toggle + "I'm learning" + stage and fade. */
export function ChatSettingsSheet({ threadId, profileId, myLang, otherName, suggestedLang, stage, fadePct }: Props) {
  const current = useThreads((s) => s.settings[threadId]) ?? { learningEnabled: false, learningLang: null };
  const setSettings = useThreads((s) => s.setSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choices = LEARNABLE.filter((l) => l !== myLang);

  const save = async (next: ThreadSettings) => {
    setSaving(true);
    setError(null);
    const before = current;
    setSettings(threadId, next); // optimistic
    try {
      setSettings(threadId, await api.putSettings(threadId, profileId, next));
    } catch (e) {
      setSettings(threadId, before);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const lang = (current.learningLang ?? (choices.includes(suggestedLang as Lang) ? suggestedLang : choices[0])) as Lang;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>✦ Heirloom</Text>
      <Text style={styles.sub}>Learn {otherName}'s language from this chat. Only you see this.</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Heirloom in this chat</Text>
        {saving && <ActivityIndicator size="small" color={colors.heirloom} style={{ marginRight: 8 }} />}
        <Switch
          value={current.learningEnabled}
          onValueChange={(on) => save({ learningEnabled: on, learningLang: on ? lang : current.learningLang })}
          trackColor={{ true: colors.heirloom, false: colors.hairline }}
          accessibilityLabel="Heirloom in this chat"
        />
      </View>

      <Text style={styles.section}>I'm learning</Text>
      <View style={styles.langs}>
        {choices.map((l) => {
          const on = l === lang;
          return (
            <Pressable
              key={l}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => save({ learningEnabled: current.learningEnabled, learningLang: l })}
              style={[styles.lang, on && styles.langOn]}
            >
              <Text style={[styles.langText, on && { color: colors.textPrimary }]}>{LANGUAGE_NAMES[l]}</Text>
            </Pressable>
          );
        })}
      </View>

      {current.learningEnabled && (
        <View style={styles.stats}>
          <Stat label="Stage" value={STAGE_LABEL[stage]} />
          <Stat label="Readable on your own" value={`${fadePct}%`} />
        </View>
      )}
      {error && <Text style={styles.error}>Couldn't save: {error}</Text>}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 16 },
  title: { fontSize: 20, fontFamily: fonts.semibold, color: colors.heirloom },
  sub: { marginTop: 4, fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary },
  row: { marginTop: 20, flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  rowLabel: { flex: 1, fontSize: 16, fontFamily: fonts.medium, color: colors.textPrimary },
  section: { marginTop: 16, fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  langs: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lang: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  langOn: { borderColor: colors.heirloom, backgroundColor: colors.heirloomTint },
  langText: { fontSize: 15, fontFamily: fonts.medium, color: colors.textSecondary },
  stats: { marginTop: 20, flexDirection: 'row', gap: 12 },
  stat: { flex: 1, padding: 12, borderRadius: radius.card, backgroundColor: colors.surface },
  statValue: { fontSize: 20, fontFamily: fonts.semibold, color: colors.textPrimary },
  statLabel: { marginTop: 2, fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
  error: { marginTop: 12, color: colors.danger, fontFamily: fonts.regular },
});
