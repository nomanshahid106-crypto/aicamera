/**
 * Pure session/version logic for PromptCam edit history.
 * No native imports here — storage lives in storage.ts so this stays testable.
 */

export interface EditVersion {
  id: string;
  /** Local file uri (inside the app's document directory). */
  uri: string;
  /** Prompt that produced this version; null for the original capture. */
  prompt: string | null;
  kind: 'original' | 'edit';
  createdAt: number;
}

export interface EditSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  versions: EditVersion[];
  /** Index into versions of the version the user is currently looking at. */
  currentVersionIndex: number;
}

/** Deterministic id helper (injectable for tests). */
export function makeId(prefix: string, now: number, randomPart: string): string {
  return `${prefix}_${now.toString(36)}_${randomPart}`;
}

export function createSession(params: {
  id: string;
  originalUri: string;
  versionId: string;
  now: number;
}): EditSession {
  const original: EditVersion = {
    id: params.versionId,
    uri: params.originalUri,
    prompt: null,
    kind: 'original',
    createdAt: params.now,
  };
  return {
    id: params.id,
    createdAt: params.now,
    updatedAt: params.now,
    versions: [original],
    currentVersionIndex: 0,
  };
}

export function currentVersion(session: EditSession): EditVersion {
  const v = session.versions[session.currentVersionIndex] ?? session.versions[0];
  if (!v) {
    throw new Error('Session has no versions');
  }
  return v;
}

export function originalVersion(session: EditSession): EditVersion {
  const v = session.versions[0];
  if (!v) {
    throw new Error('Session has no versions');
  }
  return v;
}

/**
 * Append a new edited version. Iterative editing: the new version is based on
 * whatever version was current, and becomes the current version.
 */
export function addVersion(
  session: EditSession,
  version: EditVersion,
  now: number,
): EditSession {
  return {
    ...session,
    versions: [...session.versions, version],
    currentVersionIndex: session.versions.length,
    updatedAt: now,
  };
}

export function selectVersion(session: EditSession, index: number): EditSession {
  if (index < 0 || index >= session.versions.length) {
    return session;
  }
  return { ...session, currentVersionIndex: index };
}

/** Undo = step back to the previous version (no-op on the original). */
export function undo(session: EditSession): EditSession {
  if (session.currentVersionIndex <= 0) {
    return session;
  }
  return { ...session, currentVersionIndex: session.currentVersionIndex - 1 };
}

export function redo(session: EditSession): EditSession {
  if (session.currentVersionIndex >= session.versions.length - 1) {
    return session;
  }
  return { ...session, currentVersionIndex: session.currentVersionIndex + 1 };
}

export function removeSession(sessions: EditSession[], id: string): EditSession[] {
  return sessions.filter((s) => s.id !== id);
}

export function upsertSession(sessions: EditSession[], session: EditSession): EditSession[] {
  const existing = sessions.findIndex((s) => s.id === session.id);
  if (existing === -1) {
    return [session, ...sessions];
  }
  const next = [...sessions];
  next[existing] = session;
  return next;
}

/** Sort newest-updated first (history list order). */
export function sortSessions(sessions: EditSession[]): EditSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

function isValidVersion(v: unknown): v is EditVersion {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.uri === 'string' &&
    (o.prompt === null || typeof o.prompt === 'string') &&
    (o.kind === 'original' || o.kind === 'edit') &&
    typeof o.createdAt === 'number'
  );
}

function isValidSession(s: unknown): s is EditSession {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number' &&
    Array.isArray(o.versions) &&
    o.versions.length > 0 &&
    o.versions.every(isValidVersion) &&
    typeof o.currentVersionIndex === 'number' &&
    o.currentVersionIndex >= 0 &&
    o.currentVersionIndex < o.versions.length
  );
}

/** Parse persisted sessions JSON; anything malformed is dropped, never throws. */
export function parseSessions(json: string | null): EditSession[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSession);
  } catch {
    return [];
  }
}

export function serializeSessions(sessions: EditSession[]): string {
  return JSON.stringify(sessions);
}
