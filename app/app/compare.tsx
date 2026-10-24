import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { currentVersion, originalVersion } from '@/lib/sessions';
import type { EditSession } from '@/lib/sessions';
import { getSession } from '@/lib/storage';
import { colors } from '@/theme';

type Mode = 'slider' | 'before' | 'after';

export default function CompareScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<EditSession | null>(null);
  const [mode, setMode] = useState<Mode>('slider');
  const [split, setSplit] = useState(0.5);
  const [frameWidth, setFrameWidth] = useState(0);
  const splitRef = useRef(split);
  splitRef.current = split;

  useEffect(() => {
    if (sessionId) {
      void getSession(sessionId).then(setSession);
    }
  }, [sessionId]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        setFrameWidth((w) => {
          if (w > 0) {
            const next = Math.min(1, Math.max(0, x / w));
            setSplit(next);
          }
          return w;
        });
      },
    }),
  ).current;

  if (!session) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const before = originalVersion(session);
  const after = currentVersion(session);
  const sameImage = before.id === after.id;

  async function saveToGallery() {
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to save the edited photo.');
      return;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(after.uri);
      Alert.alert('Saved', 'The edited photo was saved to your gallery.');
    } catch {
      Alert.alert('Save failed', 'The photo could not be saved. Try again.');
    }
  }

  async function share() {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(after.uri, { mimeType: 'image/png' });
    } else {
      Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
    }
  }

  return (
    <View style={styles.container}>
      <View
        style={styles.frame}
        onLayout={(e) => setFrameWidth(e.nativeEvent.layout.width)}
        {...(mode === 'slider' ? panResponder.panHandlers : {})}
      >
        {/* After (full frame, underneath) */}
        <Image source={{ uri: after.uri }} style={styles.fill} resizeMode="contain" />
        {/* Before (clipped overlay in slider / before modes) */}
        {(mode === 'before' || (mode === 'slider' && !sameImage)) && (
          <View
            style={[
              styles.beforeClip,
              mode === 'slider' ? { width: frameWidth * split } : { width: '100%' },
            ]}
          >
            <Image
              source={{ uri: before.uri }}
              style={[styles.fill, { width: frameWidth || undefined }]}
              resizeMode="contain"
            />
          </View>
        )}
        {mode === 'slider' && !sameImage && frameWidth > 0 && (
          <View style={[styles.divider, { left: frameWidth * split - 1 }]}>
            <View style={styles.handle}>
              <Ionicons name="swap-horizontal" size={16} color={colors.bg} />
            </View>
          </View>
        )}
        <View style={styles.tagLeft}>
          <Text style={styles.tagText}>Before</Text>
        </View>
        <View style={styles.tagRight}>
          <Text style={styles.tagText}>After</Text>
        </View>
      </View>

      {sameImage && (
        <Text style={styles.note}>
          No edits yet — the “after” image is still the original. Run an edit first,
          then compare here.
        </Text>
      )}
      {!!after.prompt && <Text style={styles.note}>Last edit: “{after.prompt}”</Text>}

      <View style={styles.modeRow}>
        {(['before', 'slider', 'after'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.modeButton, mode === m && styles.modeButtonActive]}
            onPress={() => setMode(m)}
          >
            <Text
              style={[styles.modeButtonText, mode === m && styles.modeButtonTextActive]}
            >
              {m === 'slider' ? 'Slider' : m === 'before' ? 'Before' : 'After'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.primaryButton} onPress={saveToGallery}>
          <Ionicons name="download" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Save to gallery</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={share}>
          <Ionicons name="share-social" size={18} color={colors.accent} />
          <Text style={styles.secondaryButtonText}>Share</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Drag on the photo to move the comparison slider.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 14 },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    height: 380,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    position: 'relative',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  beforeClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -14,
  },
  tagLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(11,18,32,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(11,18,32,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  modeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  modeButtonTextActive: { color: '#FFFFFF' },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
