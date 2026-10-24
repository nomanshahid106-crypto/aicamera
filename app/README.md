# PromptCam (Expo app)

AI camera app: capture or import a photo, type a prompt, get an AI-edited
photo back — for free, via Qwen's official public Hugging Face Space.

## Stack
React Native (Expo SDK 52, RN 0.76, TypeScript strict, Expo Router).

## Run
```bash
npm install
npx expo start        # scan the QR with Expo Go, or press "a" for Android
```

## Configure the AI engine
**No setup is needed.** The app defaults to Qwen's official public Space
`Qwen/Qwen-Image-Edit-2511`
(`https://qwen-qwen-image-edit-2511.hf.space`), public and free on
ZeroGPU. Just run the app and edit.

Optional overrides, in priority order:
1. **Settings** tab → Space URL (saved on the phone) — e.g. to point at
   your own Space later.
2. `EXPO_PUBLIC_HF_SPACE_URL` in `.env` before building.
3. The built-in default above.

Optional: paste an HF token in Settings to make edits consume your own
personal ZeroGPU quota instead of the shared public one. Stored only in
`expo-secure-store`; never required.

### Why not our own Space?
The original design self-hosted the engine (see `../hf-space/`). That
route is currently blocked: Hugging Face paywalls Gradio Space creation
on brand-new free accounts (the free ZeroGPU exception needs a verified
email and an account older than 30 days). Qwen's official Space removes
the whole setup step. `../hf-space/` stays in the repo as an option for
later (account >30 days old, or PRO).

## How editing works
`src/lib/hfEdit.ts` implements the Gradio API flow against the Space
(upload → `call/infer` with the 9-argument payload → SSE poll → result is
a `[gallery, seed]` tuple → download the first gallery image). Results are copied into
the app's local storage; sessions/versions live in AsyncStorage
(`src/lib/sessions.ts` pure logic, `src/lib/storage.ts` persistence).
No account, no backend, no per-edit cost.

## Verify
```bash
npx tsc --noEmit
npx jest
npx expo export --platform android
```
(If `npm install` fails with EPERM inside `~/workspace`, copy the project to
/tmp, install and verify there — a known setgid quirk of this workspace.)

## Icons
`assets/icon.png`, `adaptive-icon.png`, `splash.png` are local placeholder
bitmaps (git-ignored). Generate real branding before any release.
