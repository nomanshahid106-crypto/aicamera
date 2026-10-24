import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  DEFAULT_SPACE_URL,
  buildSpaceBaseUrl,
  isSpaceConfigured,
  resolveSpaceUrl,
} from './hfEdit';

const SPACE_URL_KEY = 'promptcam.spaceUrl';
const HF_TOKEN_KEY = 'promptcam.hfToken';

export { DEFAULT_SPACE_URL };

/**
 * Optional build-time env override.
 * EXPO_PUBLIC_ vars are inlined by Expo at bundle time.
 */
export function envSpaceUrl(): string {
  return (process.env.EXPO_PUBLIC_HF_SPACE_URL ?? '').trim();
}

/** The user's Settings value wins over the env default. */
export async function getSpaceUrlOverride(): Promise<string> {
  try {
    return ((await AsyncStorage.getItem(SPACE_URL_KEY)) ?? '').trim();
  } catch {
    return '';
  }
}

export async function setSpaceUrlOverride(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) {
    await AsyncStorage.removeItem(SPACE_URL_KEY);
    return;
  }
  // Validate before saving so a typo fails in Settings, not at edit time.
  buildSpaceBaseUrl(trimmed);
  await AsyncStorage.setItem(SPACE_URL_KEY, trimmed);
}

export async function getEffectiveSpaceUrl(): Promise<string> {
  const override = await getSpaceUrlOverride();
  // Settings > env > built-in default (Qwen's official public Space), so
  // the app works out of the box with no Space setup at all.
  return resolveSpaceUrl({ settingsUrl: override, envUrl: envSpaceUrl() });
}

export async function isEngineConfigured(): Promise<boolean> {
  return isSpaceConfigured(await getEffectiveSpaceUrl());
}

/**
 * HF token: stored ONLY in SecureStore (hardware-backed where available).
 * Never AsyncStorage, never logged.
 */
export async function getHfToken(): Promise<string> {
  try {
    return ((await SecureStore.getItemAsync(HF_TOKEN_KEY)) ?? '').trim();
  } catch {
    return '';
  }
}

export async function setHfToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    await SecureStore.deleteItemAsync(HF_TOKEN_KEY);
    return;
  }
  await SecureStore.setItemAsync(HF_TOKEN_KEY, trimmed);
}
