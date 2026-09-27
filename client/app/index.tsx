import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../src/components/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { CAST, castBySlug, LANGUAGE_NAMES, NATIVE_NAMES } from '../src/lib/cast';
import { useSession } from '../src/store/session';
import { colors, fonts, PRESSED_OPACITY, radius, type } from '../src/theme/tokens';

// Persona picker ("Who are you?"). `?as=arjun` picks directly, so each iPhone keeps its identity.
export default function PersonaPicker() {
  const params = useLocalSearchParams<{ as?: string; pick?: string }>();
  const as = useSession((s) => s.as);
  const setAs = useSession((s) => s.setAs);
  const router = useRouter();

  const fromUrl = castBySlug(params.as)?.slug;
  useEffect(() => {
    if (fromUrl && fromUrl !== as) setAs(fromUrl);
  }, [fromUrl, as, setAs]);

  if ((fromUrl || as) && !params.pick) return <Redirect href="/chats" />;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.brand}>✦ Heirloom</Text>
        <Text style={styles.tagline}>Translation that fades.{'\n'}Fluency that stays.</Text>
      </View>
      <Text style={styles.prompt}>Who are you?</Text>
      <View style={styles.list}>
        {CAST.map((c) => (
          <Pressable
            key={c.slug}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, ${LANGUAGE_NAMES[c.language] ?? c.language}`}
            style={({ pressed }) => [styles.person, pressed && { opacity: PRESSED_OPACITY }]}
            onPress={() => {
              setAs(c.slug);
              router.replace('/chats');
            }}
          >
            <Avatar id={c.id} name={c.name} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={[styles.language, c.language === 'ur' && styles.urdu]}>{NATIVE_NAMES[c.language] ?? c.language}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  hero: { marginTop: 32, gap: 12 },
  brand: { color: colors.heirloom, fontFamily: fonts.semibold, fontSize: type.title, letterSpacing: type.headingSpacing },
  tagline: { fontSize: type.display, lineHeight: 34, fontFamily: fonts.semibold, letterSpacing: type.headingSpacing, color: colors.textPrimary },
  prompt: { marginTop: 32, fontSize: type.meta, fontFamily: fonts.medium, color: colors.textSecondary },
  list: { marginTop: 12, gap: 12 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.background,
  },
  name: { fontSize: type.title, fontFamily: fonts.semibold, letterSpacing: type.headingSpacing, color: colors.textPrimary },
  language: { marginTop: 4, fontSize: type.secondary, fontFamily: fonts.regular, color: colors.textSecondary },
  urdu: { fontFamily: fonts.urdu, lineHeight: 30, writingDirection: 'rtl', textAlign: 'left' },
});
