---
title: PromptCam AI Engine
emoji: 📸
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 5.42.0
app_file: app.py
pinned: false
license: apache-2.0
models:
  - Qwen/Qwen-Image-Edit
---

# PromptCam AI Engine (Hugging Face Space)

> **⚠️ STATUS (2026-10-23): NOT currently used — kept as an option for later.**
> Deploying this Space turned out to be blocked: Hugging Face paywalls
> Gradio Space creation on brand-new free accounts (the SDK is shown as
> "Paid"; the free ZeroGPU hosting exception requires a verified email AND
> an account older than 30 days). Nothing was created or uploaded.
>
> **The app therefore defaults to Qwen's OFFICIAL public Space instead:**
> `Qwen/Qwen-Image-Edit-2511` at
> `https://qwen-qwen-image-edit-2511.hf.space` — public, free on ZeroGPU,
> no token required, single endpoint `/infer`. The app client
> (`../app/src/lib/hfEdit.ts`) now targets that Space; the Settings screen
> can still override the URL, so this self-hosted Space can be switched to
> later (account >30 days old, or PRO) with no code change beyond the URL.
>
> Everything below describes this optional self-hosted route as originally
> designed.

Free prompt-based photo editing backend for the **PromptCam** Android app.
It runs the open model **Qwen/Qwen-Image-Edit** (diffusers `QwenImageEditPipeline`)
on Hugging Face **ZeroGPU** — free GPU time with a daily quota, no API bills.

## The API this Space exposes (self-hosted route only)

Gradio exposes one function with `api_name="edit_image"`. The app calls:

1. **Upload the photo**
   `POST {SPACE_URL}/gradio_api/upload` — multipart form, field name `files`
   → returns a list with the uploaded file path.
2. **Start the edit**
   `POST {SPACE_URL}/gradio_api/call/edit_image`
   ```json
   { "data": [ {"path": "<uploaded path>", "meta": {"_type": "gradio.FileData"}}, "Change the background to a beach", 0, 28 ] }
   ```
   (arguments are: image, prompt, seed, steps) → returns `{ "event_id": "..." }`.
3. **Read the result (SSE)**
   `GET {SPACE_URL}/gradio_api/call/edit_image/{event_id}`
   → stream ends with `event: complete` and `data: [ { "url": "...", "path": "..." } ]`; download the file from `url` (or `{SPACE_URL}/gradio_api/file={path}`).
4. If you set an HF token in the app, every request carries `Authorization: Bearer <token>`.

## Deploy it yourself (optional, later — one-time, ~15 minutes)

Prerequisite: a Hugging Face account that is **older than 30 days** with a
verified email (or a PRO account) — on brand-new free accounts Gradio Space
creation is paywalled, which is why the app ships pointing at Qwen's
official Space instead. You need your **own Hugging Face account** — sign
up yourself; never share your password.

1. Go to https://huggingface.co/join and create a free account, verify your email.
2. Go to https://huggingface.co/new-space
   - **Name:** e.g. `promptcam-engine` (your Space URL becomes `https://<your-username>-promptcam-engine.hf.space`)
   - **SDK:** Gradio
   - **Hardware:** choose **ZeroGPU** (free). Note: ZeroGPU requires the Space to be public or owned by you while you call it with your token — for a personal MVP, a public Space is simplest. Your *photos* are not stored by the Space after a request; only the code/model are public.
   - Create the Space.
3. In the Space, open **Files → Add file → Upload files** and upload the 3 files from this folder:
   - `app.py`
   - `requirements.txt`
   - `README.md` (this file — its YAML frontmatter at the top configures the Space)
4. The Space will build (installs torch/diffusers and downloads the ~40 GB model on first run). First build + model download can take a while — wait until the Space status shows **Running**.
5. Copy your Space URL: it looks like `https://<your-username>-promptcam-engine.hf.space`
   (open the Space, use the "Embed this Space" / direct-URL option, or construct it from your username + space name as above).
6. Open **PromptCam → Settings** on your phone, paste the Space URL, tap **Save**. Leave the HF token empty unless your Space is private — if it is private, create a token at https://huggingface.co/settings/tokens (Read role is enough) and paste it in Settings too (stored in the phone's secure store).

## Honest limits of the free tier

- **ZeroGPU is quota-limited**: free accounts get a daily GPU-time allowance. When it runs out, edits fail with a quota error until it resets — the app shows this clearly.
- **Speed**: an edit typically takes ~30–120 seconds including queue time. The app allows up to 5 minutes.
- **Sleeping**: free Spaces sleep after inactivity; the first request after sleep waits for a wake-up.
- **Not for production scale**: this is a personal MVP engine. If PromptCam grows, swap the backend (the app only talks to this Gradio API shape, so a paid host can replace it later).

## Files

- `app.py` — Gradio app: loads `QwenImageEditPipeline` on CPU, `@spaces.GPU(duration=120)` runs each edit on GPU.
- `requirements.txt` — pinned dependency majors known to work together.
