import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { BrandHeaderTitle } from '@/components/BrandHeader';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerTitle: ({ children }) => <BrandHeaderTitle title={String(children)} />,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="edit" options={{ title: 'Edit photo' }} />
        <Stack.Screen name="compare" options={{ title: 'Before / After' }} />
      </Stack>
    </>
  );
}
