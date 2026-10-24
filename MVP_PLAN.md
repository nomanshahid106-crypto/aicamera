# AI Camera App — MVP Plan
Prepared: 2026-10-23
Idea (user): User captures his own picture in-app. After capture, if he wants to change something, he edits the picture by typing a prompt.

## Working name options
1. PromptCam (clearest)
2. SnapEdit AI
3. ReShoot
4. PicPrompt
Recommendation: PromptCam — says exactly what it does.

## Core flow (MVP — 5 screens)
1. **Camera** — front/back flip, flash, grid, gallery import (also allow picking existing photo, not only capture)
2. **Preview** — Retake / Use Photo, basic crop + rotate (free, on-device, no AI cost)
3. **Edit by Prompt** — big text box + preset chips (see below) + iterative editing: edit the edited result again
4. **Processing / Result** — loading state (~10-20s), Before/After slider, Undo to previous version, version history
5. **Gallery / History** — all originals + edits saved locally, Save to phone, Share, Delete

Auth, payments, social feed: NOT in MVP. Add after core edit works.

## Preset prompt chips (critical for users who don't know what to type)
- Remove background person / Change background to beach / to office / to mountains
- Make it cinematic / Make skin smooth / Remove pimples / Whiten teeth
- Change shirt to black / Add sunglasses / Change hairstyle
- Make it look professional for LinkedIn / Turn into cartoon / Turn into painting
- Remove this object (user types object) / Brighten / Old photo restore

## Tech stack — reuse the Counterly pattern he already knows
- **App:** React Native (Expo + TypeScript) — same as POS app, runs on his Android device the same way
- **Backend:** Supabase — Auth (later), Storage for originals/edits, Postgres for edit history + credits
- **AI call:** Supabase Edge Function ONLY. Never call the AI API directly from the phone — API key would be extractable from the APK.
  Flow: Phone -> Edge Function (checks credits, moderates prompt) -> AI provider -> store result in Supabase Storage -> return URL to phone

## AI provider — checked 2026-10-23
| Provider / model | Cost per edit | Notes |
|---|---|---|
| Google Gemini 2.5 Flash Image "Nano Banana" | ~$0.039 / image | Best character/face consistency — keeps the person looking like himself across edits. Multi-turn editing native. Original model deprecated Oct 2026 in some listings — successors: Nano Banana 2 Lite ~$0.034, Nano Banana 2 ~$0.067, Pro ~$0.134 |
| FLUX.1 Kontext Pro (via Replicate / fal.ai) | $0.04 / image | Strong local edits, good fallback / A-B option |
| FLUX.1 Kontext Max | $0.08 / image | Premium tier option |
| OpenAI GPT Image | ~$0.03-$0.06+ / edit | Good, slower in tests |

**Recommendation for MVP:** Gemini Nano Banana family as primary (best identity preservation for selfies, which is the whole point of this app), FLUX Kontext Pro as swappable second provider behind the Edge Function so we can switch without an app update.

## Unit economics (at ~Rs 280 / USD)
- 1 AI edit ≈ $0.034-$0.04 ≈ **Rs 10-11 per edit** in API cost
- Free tier that is sustainable: 3-5 free edits/day per user
- Paid pack idea: Rs 299 for 50 edits (cost ~Rs 550 at full use — too tight) → better: Rs 499 / 50 edits, or subscription Rs 799/mo for 100 edits. Re-price once real usage is known.
- Add credits system in MVP schema from day 1, even if all edits are free in v1 — retrofitting credits is painful.

## Must-haves / risks
- **Content safety:** block prompts for other people's photos misuse / explicit edits; Gemini + Supabase Edge Function moderation check. Play Store requires AI-generated content policy + in-app report/block + AI disclosure.
- **Watermark/disclosure:** Gemini outputs carry invisible SynthID; add "AI edited" label in share sheet.
- **Privacy:** photos are personal — private Supabase Storage bucket per user, auto-delete originals option, clear privacy note.
- **Offline/failure:** if AI call fails or times out, do NOT charge a credit; show retry.
- **Image size:** compress capture to max 1024-1536px before upload — cuts upload time and cost, no quality loss for this use.

## Build order (if he says go)
1. Expo project scaffold + Camera + Gallery import + Preview/crop
2. Supabase project + Storage + Edge Function calling Gemini with his API key (he signs in / provides key via secure route, never in chat — same pattern as POS)
3. Prompt screen + presets + Before/After + version history
4. Save/Share + History screen
5. Credits counter (free mode) + tests + Android bundle verification — same verification standard as Counterly (tsc clean, Jest, bundle export)

## Open choices for user
1. Name: PromptCam or his own?
2. Start building MVP now, or design screens first (like Counterly collect-first workflow)?
3. Does he have / want a Google AI Studio (Gemini) API key, or should signup be step 1?

---

## REVISION 2026-10-23 (later) — User requires FREE editing

User: "i need free editing in app". Checked 2026-10-23:

**Hard truth:** No major API gives prompt-based photo editing for free in production.
- Gemini API: image free tier = "Not available" for every Nano Banana model; cheapest paid $0.0336/1K image.
- OpenAI / Replicate: no free tier for image editing.
Someone always pays for the GPU. "Free" must be one of these three designs:

### Option A — Free MVP / testing (RECOMMENDED to start, $0)
Self-host an open model on a free GPU:
- **Qwen-Image-Edit (Apache 2.0)** or FLUX Kontext dev on **Hugging Face Spaces + ZeroGPU** (free GPU quota, allocated per request). Build a small Gradio Space; app calls its API via our backend.
- Cost: $0. Limits: queue + slower (est. 30-90s/edit), daily ZeroGPU quota, HF account needed, NOT Play-Store scale — perfect to test the idea on his own phone.
- Also testable: Pollinations free Flux route (no key for basic generation; its Kontext/Nano Banana models run on paid "Pollen" credits, and newer endpoint requires a key — do not rely on it as sole production engine).

### Option B — Free for users, ads pay the bill (production model)
Users pay nothing. A rewarded/interstitial ad per edit covers the ~Rs 10-11 Nano Banana cost. This is how most "free" AI photo apps on Play Store actually work. Requires AdMob + the paid API once users grow.

### Option C — On-device free edits (unlimited, $0 forever, limited scope)
On-phone, no server: background remove/replace (segmentation), beauty/skin, filters, color, crop.
Hybrid trick: generate a new background with Cloudflare Workers AI free tier (10,000 neurons/day ≈ 173 images/day at 1024px, flux-1-schnell — text-to-image only, cannot edit a photo itself), composite the person onto it on-device.
Cannot do open-ended generative prompts ("add sunglasses, change my shirt") on-device at Nano Banana quality.

### Revised recommendation
Build MVP on **Option A** (free, validates the whole flow on his device) with the provider hidden behind our backend, so switching to **Option B** (Nano Banana + ads) later is a backend change only — no app rewrite. Add Option C presets where they are free and instant.

---

## BUILD STATUS — 2026-10-23 (Option A free MVP, BUILT)

**Decision taken:** User chose "Build free MVP — HF ZeroGPU (Option A)". Final product shape differs from the original plan in one respect: personal MVP, **no Supabase / no auth / no credits** — history is local-only, and the AI engine is the user's own free HF Space. The provider still sits behind one client module (`app/src/lib/hfEdit.ts`), so a future switch to Option B remains a small change.

### Done ✅
- **Expo app** in `app/` — "PromptCam", slug/scheme `promptcam`, Android package `com.promptcam.app`, Expo SDK 52 / RN 0.76 / TS strict / Expo Router:
  - Camera screen (CameraView, flip, flash, capture, gallery import)
  - Edit screen: prompt input + 12 preset chips, iterative editing (each edit builds on the current version), version strip with select + Undo, clear "Set up your free AI engine" state when no Space URL is configured
  - Compare screen: Before/After toggle + drag slider, Save to gallery (expo-media-library), Share (expo-sharing)
  - History: sessions persisted locally (images in app document directory, metadata in AsyncStorage), reopen + delete
  - Settings: Space URL field (Settings overrides `EXPO_PUBLIC_HF_SPACE_URL`), optional HF token stored **only in SecureStore**, setup instructions + links
  - `src/lib/hfEdit.ts`: real Gradio flow (upload → `call/edit_image` → SSE poll → result URL), timeout + mapped errors (quota / queue full / sleeping / network). **No mock results.** *(Endpoint later changed to `/infer` on Qwen's official Space — see PIVOT section below.)*
- **HF Space** in `hf-space/` — `app.py` (Gradio, `api_name="edit_image"`, `QwenImageEditPipeline` for `Qwen/Qwen-Image-Edit`, bf16, `@spaces.GPU(duration=120)`, model on CPU at import), pinned `requirements.txt`, `README.md` with Spaces frontmatter + deploy steps. `python3 -m py_compile` passes.
- **Verified** (in a /tmp copy, per the workspace EPERM quirk): `npm install` OK (1103 packages), `npx tsc --noEmit` clean, `npx jest` **30/30 tests pass** (presets, hfEdit builders/error mapping/full mocked flow, session logic), `npx expo export --platform android` OK — Hermes bundle **3,001,788 bytes (~3.0 MB)**, dist 6.8 MB.

### The ONE remaining user step ⏳ — SUPERSEDED, see pivot below
(The original step — user deploys his own Space — turned out to be blocked
by HF's new-account paywall; it is no longer required.)

Known free-tier reality: ZeroGPU daily quota, ~1–3 min per edit incl. queue, Space sleeps when idle.

---

## PIVOT — 2026-10-23 (later): Qwen's OFFICIAL public Space

**Blocker:** The user created his free HF account (username nomi437) and
tried to create the Space: on brand-new free accounts the Gradio/Docker
SDK is greyed out as **"Paid"**. HF's free ZeroGPU hosting exception
requires a verified email AND an account **older than 30 days** (up to 2
ZeroGPU Spaces). Nothing was created or uploaded; PRO was NOT taken (user
wants free).

**Pivot:** The app now defaults to Qwen's official public Space —
`Qwen/Qwen-Image-Edit-2511`, direct URL
`https://qwen-qwen-image-edit-2511.hf.space`, Running on ZeroGPU, public,
no token required (an optional HF token in Settings makes calls consume
the token owner's own ZeroGPU quota).

**What changed in the app:**
- `hfEdit.ts`: endpoint `edit_image` → **`/infer`** (the Space's only
  endpoint). New 9-argument payload in the exact order from
  `/gradio_api/info`: `[images gallery [{image:{path, meta}, caption:null}],
  prompt, seed 0, randomize_seed true, true_guidance_scale 4,
  num_inference_steps 40, height, width, rewrite_prompt false]`.
  Height/width come from the source photo, clamped to 256–2048 and rounded
  to a multiple of 16 (fallback 1024). `rewrite_prompt=false` deliberately —
  preserve the user's exact instruction, avoid extra rewriting latency.
  Result parsing fixed for the **tuple** response `[result gallery, seed]`
  (first gallery item is the edited image).
- **Built-in default:** the Qwen Space URL is baked in as
  `DEFAULT_SPACE_URL`; resolution order Settings > `EXPO_PUBLIC_HF_SPACE_URL`
  env > built-in default. The app now edits **out of the box** — the Edit
  screen's setup card only shows if the effective URL is somehow empty.
- **Settings copy:** no Space creation needed; URL field is an optional
  override (e.g. his own Space later); token is optional (own quota).
- `hf-space/` code **stays in the repo** as an option for later (account
  >30 days old or PRO) — switching is just pasting its URL into Settings.
- Tests updated to the new payload/tuple/defaults. **Verified after the
  pivot** (in a /tmp copy): `npx tsc --noEmit` clean, `npx jest --ci`
  **40/40 pass** (3 suites; was 30 before, +10 for the new payload, tuple
  parsing, dimension helper and defaults resolution),
  `npx expo export --platform android` OK — Hermes bundle **3,005,687
  bytes**, and a live quota-free check: `GET
  https://qwen-qwen-image-edit-2511.hf.space/gradio_api/info` → HTTP 200,
  only endpoint `/infer`, parameter order/defaults exactly as implemented.
  No actual edit generation was run.

**Remaining user step: NONE for editing.** Run the app
(`cd app && npm install && npx expo start`), take a photo, edit — free.
