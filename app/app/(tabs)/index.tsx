import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BrandHeader } from '@/components/BrandHeader';
import { startSession } from '@/lib/storage';
import { colors } from '@/theme';

type Facing = 'front' | 'back';
type Flash = 'off' | 'on';

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<Facing>('back');
  const [flash, setFlash] = useState<Flash>('off');
  const [busy, setBusy] = useState(false);

  async function openEditor(sourceUri: string) {
    setBusy(true);
    try {
      const session = await startSession(sourceUri);
      router.push({ pathname: '/edit', params: { sessionId: session.id } });
    } catch {
      Alert.alert('Could not save photo', 'The photo could not be copied into PromptCam. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    if (!cameraRef.current || busy) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        await openEditor(photo.uri);
      }
    } catch {
      Alert.alert('Capture failed', 'The camera could not take a photo. Try again.');
    }
  }

  async function importFromGallery() {
    if (busy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to import a picture to edit.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    const uri = result.canceled ? undefined : result.assets?.[0]?.uri;
    if (uri) {
      await openEditor(uri);
    }
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <BrandHeader size="large" subtitle="Capture a photo, then edit it by typing a prompt." />
        <Text style={styles.message}>
          PromptCam needs camera access to take a photo you can edit with a prompt.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Allow camera</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={importFromGallery}>
          <Text style={styles.secondaryButtonText}>Or pick from gallery</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      />
      <View style={styles.controls}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}
          accessibilityLabel="Toggle flash"
        >
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off'}
            size={24}
            color={colors.text}
          />
        </Pressable>
        <Pressable
          style={styles.shutter}
          onPress={capture}
          disabled={busy}
          accessibilityLabel="Take photo"
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
          accessibilityLabel="Flip camera"
        >
          <Ionicons name="camera-reverse" size={26} color={colors.text} />
        </Pressable>
      </View>
      <Pressable
        style={styles.galleryButton}
        onPress={importFromGallery}
        disabled={busy}
      >
        <Ionicons name="images-outline" size={20} color={colors.accentSoft} />
        <Text style={styles.galleryButtonText}>Import from gallery</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  camera: { flex: 1 },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  message: { color: colors.text, fontSize: 16, textAlign: 'center', lineHeight: 22 },
  controls: {
    position: 'absolute',
    bottom: 76,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(11,18,32,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.accent,
  },
  galleryButton: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(11,18,32,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  galleryButtonText: { color: colors.accentSoft, fontSize: 14, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButton: { paddingHorizontal: 24, paddingVertical: 12 },
  secondaryButtonText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
