import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandHeader } from '@/components/BrandHeader';
import { HfEditError, editImageWithPrompt } from '@/lib/hfEdit';
import { PRESET_PROMPTS } from '@/lib/presets';
import {
  EditSession,
  addVersion,
  currentVersion,
  makeId,
  selectVersion,
  undo,
} from '@/lib/sessions';
import { getEffectiveSpaceUrl, getHfToken } from '@/lib/settings';
import { downloadEditedPhoto, getSession, persistSession } from '@/lib/storage';
import { colors } from '@/theme';

export default function EditScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<EditSession | null>(null);
  const [prompt, setPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [spaceUrl, setSpaceUrl] = useState('');

  const load = useCallback(async () => {
    if (!sessionId) return;
    setSession(await getSession(sessionId));
    setSpaceUrl(await getEffectiveSpaceUrl());
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!session) {
    return (
      <View style={styles.centered}>
        <BrandHeader size="large" />
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Loading photo…</Text>
      </View>
    );
  }

  const current = currentVersion(session);
  const configured = spaceUrl.trim().length > 0;

  async function runEdit() {
    const trimmed = prompt.trim();
    if (!session || editing) return;
    if (!trimmed) {
      setErrorText('Type a prompt first — or tap one of the preset chips below.');
      return;
    }
    setEditing(true);
    setErrorText(null);
    try {
      const token = await getHfToken();
      // The /infer endpoint wants output height/width — use the source
      // photo's real dimensions (the client clamps/rounds them). If the
      // size can't be read, fall back to 1024x1024.
      const size = await new Promise<{ width: number; height: number }>(
        (resolve) => {
          Image.getSize(
            current.uri,
            (width, height) => resolve({ width, height }),
            () => resolve({ width: 1024, height: 1024 }),
          );
        },
      );
      const result = await editImageWithPrompt({
        spaceUrl,
        token: token || null,
        imageUri: current.uri,
        prompt: trimmed,
        width: size.width,
        height: size.height,
      });
      const localUri = await downloadEditedPhoto(result.resultUrl, token || null);
      const now = Date.now();
      const next = addVersion(
        session,
        {
          id: makeId('v', now, Math.random().toString(36).slice(2, 10)),
          uri: localUri,
          prompt: trimmed,
          kind: 'edit',
          createdAt: now,
        },
        now,
      );
      await persistSession(next);
      setSession(next);
      setPrompt('');
    } catch (e) {
      if (e instanceof HfEditError) {
        setErrorText(e.message);
      } else {
        setErrorText(
          'Something went wrong while editing. Your photo is unchanged — try again.',
        );
      }
    } finally {
      setEditing(false);
    }
  }

  async function onUndo() {
    if (!session) return;
    const next = undo(session);
    await persistSession(next);
    setSession(next);
  }

  async function onSelectVersion(index: number) {
    if (!session) return;
    const next = selectVersion(session, index);
    await persistSession(next);
    setSession(next);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image source={{ uri: current.uri }} style={styles.preview} resizeMode="contain" />
      <Text style={styles.versionLabel}>
        {current.kind === 'original'
          ? 'Original photo'
          : `Edit ${session.currentVersionIndex} — "${current.prompt ?? ''}"`}
      </Text>

      <View style={styles.row}>
        <Pressable
          style={[styles.smallButton, session.currentVersionIndex === 0 && styles.disabled]}
          onPress={onUndo}
          disabled={session.currentVersionIndex === 0}
        >
          <Ionicons name="arrow-undo" size={16} color={colors.text} />
          <Text style={styles.smallButtonText}>Undo</Text>
        </Pressable>
        <Pressable
          style={styles.smallButton}
          onPress={() =>
            router.push({ pathname: '/compare', params: { sessionId: session.id } })
          }
        >
          <Ionicons name="git-compare" size={16} color={colors.text} />
          <Text style={styles.smallButtonText}>Before / After</Text>
        </Pressable>
      </View>

      {!configured && (
        <View style={styles.setupCard}>
          <Ionicons name="sparkles" size={28} color={colors.accent} />
          <Text style={styles.setupTitle}>Set up your free AI engine</Text>
          <Text style={styles.setupText}>
            PromptCam normally edits with Qwen's official free public Space,
            which is built in — no setup needed. This card only appears if the
            engine URL was cleared; restore it in Settings to enable editing.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </Pressable>
        </View>
      )}

      {configured && (
        <>
          <Text style={styles.label}>What should change?</Text>
          <TextInput
            style={styles.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder='e.g. "change background to a beach"'
            placeholderTextColor={colors.textMuted}
            multiline
            editable={!editing}
          />
          <View style={styles.chips}>
            {PRESET_PROMPTS.map((p) => (
              <Pressable
                key={p.id}
                style={styles.chip}
                onPress={() => setPrompt(p.prompt)}
                disabled={editing}
              >
                <Text style={styles.chipText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          {errorText && <Text style={styles.error}>{errorText}</Text>}
          <Pressable
            style={[styles.primaryButton, editing && styles.disabled]}
            onPress={runEdit}
            disabled={editing}
          >
            {editing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>✨ Edit with AI (free)</Text>
            )}
          </Pressable>
          {editing && (
            <View style={styles.processingCard}>
              <BrandHeader size="small" />
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.muted}>
                Editing on the free GPU — this can take 1–3 minutes including queue time.
              </Text>
            </View>
          )}
          <Text style={styles.muted}>
            Each new edit applies to the version shown above, so you can keep
            refining it step by step.
          </Text>
        </>
      )}

      <Text style={styles.label}>Versions</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.versionRow}>
          {session.versions.map((v, i) => (
            <Pressable
              key={v.id}
              onPress={() => onSelectVersion(i)}
              style={[
                styles.versionThumb,
                i === session.currentVersionIndex && styles.versionThumbActive,
              ]}
            >
              <Image source={{ uri: v.uri }} style={styles.versionImage} />
              <Text style={styles.versionCaption} numberOfLines={1}>
                {v.kind === 'original' ? 'Original' : `Edit ${i}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  preview: {
    width: '100%',
    height: 340,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  versionLabel: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  smallButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  setupCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  processingCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  setupTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  setupText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  label: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 6 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 15,
    padding: 12,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { color: colors.accentSoft, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14, lineHeight: 19 },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  versionRow: { flexDirection: 'row', gap: 10 },
  versionThumb: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
    alignItems: 'center',
  },
  versionThumbActive: { borderColor: colors.accent },
  versionImage: { width: 64, height: 64, borderRadius: 9, backgroundColor: colors.card },
  versionCaption: { color: colors.textMuted, fontSize: 11, marginTop: 4, maxWidth: 68 },
});
