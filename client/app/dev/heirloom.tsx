// Dev-only fixtures page: the Heirloom layer on sample data, no backend needed.
// Built only with EXPO_PUBLIC_DEV_FIXTURES=1; otherwise it redirects home. `?select=<token index>` opens a card.
import type { Stage } from '@heirloom/learner';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeirloomChip } from '../../src/components/HeirloomChip';
import { HeirloomMessage } from '../../src/components/HeirloomMessage';
import { esAnalysis, esMessage, fixtureMastery, urAnalysis, urMessage } from '../../src/dev/fixtures';
import { useSelection } from '../../src/store/selection';
import { colors, fonts } from '../../src/theme/tokens';

const ENABLED = process.env.EXPO_PUBLIC_DEV_FIXTURES === '1';

export default function HeirloomFixtures() {
  const params = useLocalSearchParams<{ select?: string; stage?: Stage; msg?: string }>();
  const select = useSelection((s) => s.select);
  const now = useMemo(() => Date.now(), []);
  const mastery = useMemo(() => fixtureMastery(now), [now]);
  const stage = params.stage ?? 'listener';

  useEffect(() => {
    if (params.select !== undefined) select({ messageId: params.msg ?? 'fx-es', tokenIndex: Number(params.select) });
  }, [params.select, params.msg, select]);

  if (!ENABLED) return <Redirect href="/" />;
  const view = { stage, readableShare: 0.12, fadePct: 12, mastery };
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
        <Text style={styles.h}>Heirloom fixtures ({stage})</Text>
        <HeirloomChip enabled lang="es" stage={stage} fadePct={12} onPress={() => {}} />
        <HeirloomMessage m={esMessage} pos={{ first: true, last: true }} analysis={esAnalysis} view={view} viewerLang="en" profileId="fx" now={now} />
        <HeirloomMessage
          m={urMessage}
          pos={{ first: true, last: true }}
          analysis={urAnalysis}
          view={{ ...view, mastery: {} }}
          viewerLang="en"
          profileId="fx"
          now={now}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  h: { marginHorizontal: 12, marginBottom: 8, fontFamily: fonts.semibold, fontSize: 16 },
});
