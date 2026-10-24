import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import {
  EditSession,
  createSession,
  makeId,
  parseSessions,
  serializeSessions,
  sortSessions,
  upsertSession,
  removeSession,
} from './sessions';

const SESSIONS_KEY = 'promptcam.sessions.v1';
const PHOTOS_DIR = `${FileSystem.documentDirectory ?? ''}promptcam/`;

function randomPart(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

/** Copy a photo (camera capture / gallery pick / download) into app storage. */
export async function persistPhoto(sourceUri: string, label: string): Promise<string> {
  await ensureDir();
  const extMatch = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(sourceUri);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
  const dest = `${PHOTOS_DIR}${label}_${Date.now().toString(36)}_${randomPart()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

/** Download an edited image from the Space and persist it locally. */
export async function downloadEditedPhoto(
  resultUrl: string,
  token: string | null,
): Promise<string> {
  await ensureDir();
  const dest = `${PHOTOS_DIR}edit_${Date.now().toString(36)}_${randomPart()}.png`;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await FileSystem.downloadAsync(resultUrl, dest, { headers });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Download failed (HTTP ${res.status})`);
  }
  return res.uri;
}

export async function loadSessions(): Promise<EditSession[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    return sortSessions(parseSessions(raw));
  } catch {
    return [];
  }
}

export async function saveSessions(sessions: EditSession[]): Promise<void> {
  await AsyncStorage.setItem(SESSIONS_KEY, serializeSessions(sessions));
}

export async function getSession(sessionId: string): Promise<EditSession | null> {
  const sessions = await loadSessions();
  return sessions.find((s) => s.id === sessionId) ?? null;
}

/** Create + persist a new session from a captured/imported photo uri. */
export async function startSession(sourceUri: string): Promise<EditSession> {
  const now = Date.now();
  const storedUri = await persistPhoto(sourceUri, 'original');
  const session = createSession({
    id: makeId('session', now, randomPart()),
    originalUri: storedUri,
    versionId: makeId('v', now, randomPart()),
    now,
  });
  const sessions = await loadSessions();
  await saveSessions(upsertSession(sessions, session));
  return session;
}

export async function persistSession(session: EditSession): Promise<void> {
  const sessions = await loadSessions();
  await saveSessions(upsertSession(sessions, session));
}

/** Delete a session and its local image files. */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await loadSessions();
  const target = sessions.find((s) => s.id === sessionId);
  if (target) {
    for (const v of target.versions) {
      try {
        await FileSystem.deleteAsync(v.uri, { idempotent: true });
      } catch {
        // File already gone — deletion of the session still proceeds.
      }
    }
  }
  await saveSessions(removeSession(sessions, sessionId));
}
