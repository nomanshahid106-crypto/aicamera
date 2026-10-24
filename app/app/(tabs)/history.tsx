import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EditSession, currentVersion } from '@/lib/sessions';
import { deleteSession, loadSessions } from '@/lib/storage';
import { colors } from '@/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<EditSession[]>([]);

  const refresh = useCallback(async () => {
    setSessions(await loadSessions());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  function confirmDelete(session: EditSession) {
    Alert.alert(
      'Delete this photo session?',
      'The original photo and all its edited versions stored in PromptCam will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(session.id);
            await refresh();
          },
        },
      ],
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="images-outline" size={52} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No photos yet</Text>
        <Text style={styles.emptyText}>
          Take a photo with the Camera tab, or import one, and your edit sessions
          will appear here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={sessions}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => {
        const current = currentVersion(item);
        const edits = item.versions.length - 1;
        return (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({ pathname: '/edit', params: { sessionId: item.id } })
            }
          >
            <Image source={{ uri: current.uri }} style={styles.thumb} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
              <Text style={styles.cardSub}>
                {edits === 0
                  ? 'Original only — no edits yet'
                  : `${edits} edit${edits === 1 ? '' : 's'} · last: "${current.prompt ?? ''}"`}
              </Text>
            </View>
            <Pressable
              style={styles.deleteButton}
              onPress={() => confirmDelete(item)}
              accessibilityLabel="Delete session"
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: 16, gap: 12 },
  empty: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.cardAlt },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cardSub: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  deleteButton: { padding: 8 },
});
