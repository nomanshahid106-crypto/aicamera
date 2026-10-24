import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandHeader } from '@/components/BrandHeader';
import { DEFAULT_SPACE_URL, HfEditError } from '@/lib/hfEdit';
import {
  envSpaceUrl,
  getHfToken,
  getSpaceUrlOverride,
  setHfToken,
  setSpaceUrlOverride,
} from '@/lib/settings';
import { colors } from '@/theme';

export default function SettingsScreen() {
  const [spaceUrl, setSpaceUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const envUrl = envSpaceUrl();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSpaceUrl(await getSpaceUrlOverride());
      setToken(await getHfToken());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      await setSpaceUrlOverride(spaceUrl);
      await setHfToken(token);
      Alert.alert('Saved', 'Your AI engine settings were saved on this phone.');
    } catch (e) {
      if (e instanceof HfEditError) {
        Alert.alert('Check the Space URL', e.message);
      } else {
        Alert.alert('Save failed', 'Settings could not be saved. Try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const effective = spaceUrl.trim() || envUrl || DEFAULT_SPACE_URL;
  const usingDefault = !spaceUrl.trim() && !envUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <BrandHeader size="large" subtitle="Free AI photo editing — capture, prompt, done." />
      <View style={styles.statusCard}>
        <Ionicons
          name={effective ? 'checkmark-circle' : 'alert-circle'}
          size={22}
          color={effective ? colors.success : colors.danger}
        />
        <Text style={styles.statusText}>
          {effective
            ? `AI engine ready: ${effective}${usingDefault ? ' (Qwen official Space — built-in default)' : ''}`
            : 'AI engine URL is empty — restore the default Space URL below.'}
        </Text>
      </View>

      <Text style={styles.label}>Hugging Face Space URL (optional override)</Text>
      <TextInput
        style={styles.input}
        value={spaceUrl}
        onChangeText={setSpaceUrl}
        placeholder={DEFAULT_SPACE_URL}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={styles.hint}>
        Leave this empty to use Qwen's official public Image Edit Space
        ({DEFAULT_SPACE_URL}) for free — no setup needed. Only fill it in to
        point PromptCam at a different Space (e.g. your own Space later). Any
        value here overrides the built-in default and is saved only on this
        phone.
      </Text>

      <Text style={styles.label}>Hugging Face token (optional)</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="hf_… (optional — leave empty to edit without an account)"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Text style={styles.hint}>
        Not required: the public Space works without a token. If you add your
        own HF token, edits run against your personal free ZeroGPU quota
        instead of the shared public one. Stored in this phone's secure store
        — never in plain storage, never sent anywhere except the Space.
      </Text>

      <Pressable
        style={[styles.primaryButton, saving && styles.disabled]}
        onPress={save}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Save settings</Text>
        )}
      </Pressable>

      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>About the free AI engine</Text>
        <Text style={styles.helpText}>
          PromptCam uses Qwen's official public Image Edit Space
          (Qwen/Qwen-Image-Edit-2511) on Hugging Face — free, no account and
          no setup needed. Just take a photo and edit it.{'\n\n'}
          It runs on free ZeroGPU time, which is quota-limited and shared:
          an edit can take 1–3 minutes including queue time, and when the
          quota is busy, try again later. Adding your own HF token above
          (optional) makes edits use your personal ZeroGPU quota instead.
          {'\n\n'}
          There is nothing to deploy: earlier versions of PromptCam asked you
          to create your own Space, but Hugging Face now reserves Space
          creation on brand-new free accounts — Qwen's official Space removes
          that step entirely.
        </Text>
        <Pressable
          style={styles.linkButton}
          onPress={() =>
            Linking.openURL('https://huggingface.co/spaces/Qwen/Qwen-Image-Edit-2511')
          }
        >
          <Ionicons name="open-outline" size={16} color={colors.accent} />
          <Text style={styles.linkText}>View Qwen's official Space</Text>
        </Pressable>
        <Pressable
          style={styles.linkButton}
          onPress={() => Linking.openURL('https://huggingface.co/settings/tokens')}
        >
          <Ionicons name="key-outline" size={16} color={colors.accent} />
          <Text style={styles.linkText}>Open Hugging Face — Access Tokens</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 10 },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  statusText: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
  label: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 10 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 14,
    padding: 12,
  },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  helpCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginTop: 14,
  },
  helpTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  helpText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  linkText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
