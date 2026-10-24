import {
  EditVersion,
  addVersion,
  createSession,
  currentVersion,
  parseSessions,
  redo,
  removeSession,
  selectVersion,
  serializeSessions,
  sortSessions,
  undo,
  upsertSession,
} from '../src/lib/sessions';

const NOW = 1730000000000;

function makeSession() {
  return createSession({
    id: 'session_1',
    originalUri: 'file:///docs/original.jpg',
    versionId: 'v0',
    now: NOW,
  });
}

function editVersion(id: string, prompt: string): EditVersion {
  return { id, uri: `file:///docs/${id}.png`, prompt, kind: 'edit', createdAt: NOW + 1000 };
}

describe('sessions pure logic', () => {
  it('createSession starts with one original version, selected', () => {
    const s = makeSession();
    expect(s.versions).toHaveLength(1);
    expect(s.currentVersionIndex).toBe(0);
    expect(currentVersion(s).kind).toBe('original');
    expect(currentVersion(s).prompt).toBeNull();
    expect(currentVersion(s).uri).toBe('file:///docs/original.jpg');
  });

  it('addVersion appends and selects the new version (iterative editing base)', () => {
    const s1 = addVersion(makeSession(), editVersion('v1', 'beach'), NOW + 1000);
    expect(s1.versions).toHaveLength(2);
    expect(currentVersion(s1).id).toBe('v1');
    const s2 = addVersion(s1, editVersion('v2', 'sunglasses'), NOW + 2000);
    expect(s2.versions).toHaveLength(3);
    expect(currentVersion(s2).prompt).toBe('sunglasses');
    expect(s2.updatedAt).toBe(NOW + 2000);
    // Immutability: originals untouched
    expect(s1.versions).toHaveLength(2);
  });

  it('selectVersion jumps to a version and ignores out-of-range indexes', () => {
    const s = addVersion(makeSession(), editVersion('v1', 'beach'), NOW + 1);
    expect(selectVersion(s, 0).currentVersionIndex).toBe(0);
    expect(selectVersion(s, 1).currentVersionIndex).toBe(1);
    expect(selectVersion(s, 99).currentVersionIndex).toBe(1);
    expect(selectVersion(s, -1).currentVersionIndex).toBe(1);
  });

  it('undo steps back and redo steps forward, both bounded', () => {
    let s = addVersion(makeSession(), editVersion('v1', 'a'), NOW + 1);
    s = addVersion(s, editVersion('v2', 'b'), NOW + 2);
    expect(currentVersion(s).id).toBe('v2');
    s = undo(s);
    expect(currentVersion(s).id).toBe('v1');
    s = undo(s);
    expect(currentVersion(s).id).toBe('v0');
    expect(undo(s).currentVersionIndex).toBe(0); // no-op at original
    s = redo(s);
    expect(currentVersion(s).id).toBe('v1');
    s = redo(redo(s));
    expect(currentVersion(s).id).toBe('v2'); // bounded at newest
  });

  it('removeSession deletes only the target session', () => {
    const a = makeSession();
    const b = { ...makeSession(), id: 'session_2' };
    const next = removeSession([a, b], 'session_1');
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('session_2');
  });

  it('upsertSession inserts new and replaces existing in place', () => {
    const a = makeSession();
    const inserted = upsertSession([], a);
    expect(inserted).toHaveLength(1);
    const updated = { ...a, updatedAt: NOW + 5 };
    const replaced = upsertSession(inserted, updated);
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.updatedAt).toBe(NOW + 5);
  });

  it('sortSessions orders by updatedAt descending without mutating input', () => {
    const a = { ...makeSession(), id: 'a', updatedAt: 1 };
    const b = { ...makeSession(), id: 'b', updatedAt: 3 };
    const c = { ...makeSession(), id: 'c', updatedAt: 2 };
    const input = [a, b, c];
    expect(sortSessions(input).map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(input.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('serialize/parse round-trips valid sessions', () => {
    const s = addVersion(makeSession(), editVersion('v1', 'beach'), NOW + 1);
    const parsed = parseSessions(serializeSessions([s]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.versions).toHaveLength(2);
    expect(parsed[0]?.currentVersionIndex).toBe(1);
  });

  it('parseSessions drops malformed data and never throws', () => {
    expect(parseSessions(null)).toEqual([]);
    expect(parseSessions('not json')).toEqual([]);
    expect(parseSessions('{"a":1}')).toEqual([]);
    expect(parseSessions('[{"id":123}]')).toEqual([]);
    expect(
      parseSessions(JSON.stringify([{ ...makeSession(), currentVersionIndex: 5 }])),
    ).toEqual([]);
  });
});
