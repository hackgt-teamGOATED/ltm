import { StyleSheet, Text, View } from 'react-native';
import { avatarColors, colors, fonts } from '../theme/tokens';

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
}

export function Avatar({ id, name, size = 44, ring = false }: { id: string; name: string; size?: number; ring?: boolean }) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(id) },
        ring && { borderWidth: 2, borderColor: colors.heirloom },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontFamily: fonts.semibold },
});
