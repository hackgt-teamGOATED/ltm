import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../src/components/Avatar';
import { CAST, castBySlug } from '../src/lib/cast';
import { useSession } from '../src/store/session';
import { colors, fonts } from '../src/theme/tokens';

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
      <Text style={styles.brand}>✦ Heirloom</Text>
      <Text style={styles.title}>Who are you?</Text>
      <View style={styles.list}>
        {CAST.map((c) => (
          <Pressable
            key={c.slug}
            accessibilityRole="button"
            style={({ pressed }) => [styles.person, pressed && { opacity: 0.6 }]}
            onPress={() => {
              setAs(c.slug);
              router.replace('/chats');
            }}
          >
            <Avatar id={c.id} name={c.name} size={72} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.blurb}>{c.blurb}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={styles.foot}>Translation that fades. Fluency that stays.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  brand: { marginTop: 32, color: colors.heirloom, fontFamily: fonts.semibold, fontSize: 18 },
  title: { marginTop: 8, fontSize: 32, fontFamily: fonts.semibold, color: colors.textPrimary },
  list: { marginTop: 32, gap: 16 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  name: { fontSize: 20, fontFamily: fonts.semibold, color: colors.textPrimary },
  blurb: { marginTop: 2, fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary },
  foot: {
    marginTop: 'auto',
    marginBottom: 24,
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: fonts.regular,
  },
});
