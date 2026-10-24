import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

// Final PromptCam logo (Concept 1: camera lens in a chat bubble).
// The PNG lives in app/assets/icon.png — the same file used as the app
// icon. It is gitignored (binary), so a fresh GitHub clone needs the file
// dropped into app/assets/ before the app will bundle.
const LOGO = require('../../assets/icon.png');

type Props = {
  /** Logo size in px. 'header' fits navigation headers, 'large' fits empty states. */
  size?: 'header' | 'large' | 'small';
  /** Show the "PromptCam" wordmark next to the logo. */
  showWordmark?: boolean;
  /** Optional subtitle under the wordmark (large size only). */
  subtitle?: string;
};

const SIZES = { header: 30, large: 88, small: 48 } as const;

export function BrandHeader({ size = 'header', showWordmark = true, subtitle }: Props) {
  const px = SIZES[size];
  return (
    <View style={styles.row}>
      <Image source={LOGO} style={{ width: px, height: px, borderRadius: px * 0.22 }} />
      {showWordmark && (
        <View>
          <Text style={[styles.wordmark, size === 'large' && styles.wordmarkLarge]}>
            PromptCam
          </Text>
          {subtitle && size === 'large' && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
}

/** Navigation header title: logo + screen title (used by Tabs and Stack layouts). */
export function BrandHeaderTitle({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <Image source={LOGO} style={{ width: 28, height: 28, borderRadius: 6 }} />
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { color: colors.text, fontSize: 17, fontWeight: '800' },
  wordmarkLarge: { fontSize: 24 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
