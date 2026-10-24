/**
 * Client for PromptCam's AI engine — Qwen's OFFICIAL public Hugging Face
 * Space `Qwen/Qwen-Image-Edit-2511`, running on ZeroGPU.
 *
 * Why not our own Space? HF paywalls Gradio Space creation on brand-new
 * free accounts (the free ZeroGPU hosting exception needs a verified email
 * AND an account older than 30 days), so the self-host route in
 * ../../hf-space/ is parked until the account ages (or goes PRO). Qwen's
 * official Space is public and needs no token; an optional user-supplied
 * HF token makes calls consume the token owner's own ZeroGPU quota.
 *
 * Gradio API flow implemented here (verified against the Space's
 * /gradio_api/info):
 *   1. POST {space}/gradio_api/upload            (multipart, field "files")
 *   2. POST {space}/gradio_api/call/infer         (JSON {data:[...9 args]})
 *      -> event_id. Args, in order: images gallery, prompt, seed,
 *      randomize_seed, true_guidance_scale, num_inference_steps,
 *      height, width, rewrite_prompt.
 *   3. GET  {space}/gradio_api/call/infer/{event_id}  (SSE stream)
 *   4. Result is a TUPLE: [result gallery, seed]. [0][0] is the edited
 *      image FileData -> downloadable file URL.
 *
 * No native (Expo) imports in this module, so it is unit-testable with a
 * mocked fetch. The HF token is only ever passed in by the caller (from
 * SecureStore) and is never logged.
 */

/** The only endpoint on Qwen/Qwen-Image-Edit-2511. */
export const API_NAME = 'infer';

/**
 * Built-in default engine: Qwen's official public Space. Resolution order
 * (see resolveSpaceUrl): Settings value > EXPO_PUBLIC_HF_SPACE_URL env >
 * this constant — so the app edits out of the box with zero setup.
 */
export const DEFAULT_SPACE_URL = 'https://qwen-qwen-image-edit-2511.hf.space';

/** Pick the effective Space URL: Settings override wins, then env, then built-in default. */
export function resolveSpaceUrl(params: {
  settingsUrl?: string | null;
  envUrl?: string | null;
}): string {
  const settings = (params.settingsUrl ?? '').trim();
  if (settings) return settings;
  const env = (params.envUrl ?? '').trim();
  if (env) return env;
  return DEFAULT_SPACE_URL;
}

export type HfEditErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_URL'
  | 'TIMEOUT'
  | 'QUOTA'
  | 'QUEUE_FULL'
  | 'SPACE_SLEEPING'
  | 'NETWORK'
  | 'BAD_RESPONSE'
  | 'EDIT_FAILED';

export class HfEditError extends Error {
  readonly code: HfEditErrorCode;

  constructor(code: HfEditErrorCode, message: string) {
    super(message);
    this.name = 'HfEditError';
    this.code = code;
  }
}

/** User-facing copy for each failure mode. */
export const HF_ERROR_MESSAGES: Record<HfEditErrorCode, string> = {
  NOT_CONFIGURED:
    'No AI engine URL is available. PromptCam normally uses Qwen\'s free public Space by default — check the Space URL in Settings.',
  INVALID_URL:
    'The Space URL in Settings does not look valid. It should start with https:// and end with .hf.space',
  TIMEOUT:
    'The AI engine took too long (free GPU queues can be slow). Your photo is safe — try the edit again.',
  QUOTA:
    'The free ZeroGPU quota is used up for now. It resets over time — try again later, or add your own HF token in Settings to use your personal quota.',
  QUEUE_FULL:
    'The AI engine queue is full right now. Wait a minute and try the edit again.',
  SPACE_SLEEPING:
    'The AI engine was sleeping and is waking up. Wait about a minute, then try the edit again.',
  NETWORK:
    'Could not reach the AI engine. Check your internet connection and the Space URL in Settings.',
  BAD_RESPONSE:
    'The AI engine returned something unexpected. Try the edit again; if it keeps happening, check that the Space is Running.',
  EDIT_FAILED: 'The AI engine could not complete this edit. Try a different prompt.',
};

/** Normalize a user-entered Space URL: trim, drop trailing slashes, validate. */
export function buildSpaceBaseUrl(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new HfEditError('NOT_CONFIGURED', HF_ERROR_MESSAGES.NOT_CONFIGURED);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HfEditError('INVALID_URL', HF_ERROR_MESSAGES.INVALID_URL);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HfEditError('INVALID_URL', HF_ERROR_MESSAGES.INVALID_URL);
  }
  return trimmed;
}

export function isSpaceConfigured(raw: string | null | undefined): boolean {
  try {
    buildSpaceBaseUrl(raw);
    return true;
  } catch {
    return false;
  }
}

export function buildUploadUrl(base: string): string {
  return `${base}/gradio_api/upload`;
}

export function buildCallUrl(base: string, apiName: string = API_NAME): string {
  return `${base}/gradio_api/call/${apiName}`;
}

export function buildStatusUrl(
  base: string,
  eventId: string,
  apiName: string = API_NAME,
): string {
  return `${base}/gradio_api/call/${apiName}/${eventId}`;
}

export function authHeaders(token?: string | null): Record<string, string> {
  if (token && token.trim()) {
    return { Authorization: `Bearer ${token.trim()}` };
  }
  return {};
}

export interface GradioFileData {
  path?: string;
  url?: string;
  meta?: { _type?: string };
  orig_name?: string;
}

export function buildUploadFileData(uploadedPath: string): GradioFileData {
  return { path: uploadedPath, meta: { _type: 'gradio.FileData' } };
}

/** One item of the /infer `images` gallery parameter. */
export interface InferGalleryItem {
  image: GradioFileData;
  caption: null;
}

export function buildGalleryItem(uploadedPath: string): InferGalleryItem {
  return { image: buildUploadFileData(uploadedPath), caption: null };
}

export const DIMENSION_MIN = 256;
export const DIMENSION_MAX = 2048;
export const DIMENSION_FALLBACK = 1024;

/**
 * /infer height/width rule: clamp to 256–2048 and round to a multiple of 16.
 * Missing/invalid dimensions fall back to 1024.
 */
export function normalizeDimension(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DIMENSION_FALLBACK;
  }
  const clamped = Math.min(DIMENSION_MAX, Math.max(DIMENSION_MIN, value));
  return Math.round(clamped / 16) * 16;
}

/**
 * The 9-element `data` array for POST /gradio_api/call/infer, in the exact
 * order declared by Qwen/Qwen-Image-Edit-2511's /gradio_api/info:
 * [images, prompt, seed, randomize_seed, true_guidance_scale,
 *  num_inference_steps, height, width, rewrite_prompt]
 */
export type InferData = [
  InferGalleryItem[],
  string,
  number,
  boolean,
  number,
  number,
  number,
  number,
  boolean,
];

export function buildInferData(params: {
  uploadedPath: string;
  prompt: string;
  seed?: number;
  /** num_inference_steps (Space default 40, range 1–50). */
  steps?: number;
  /** Source image height in px (normalized here). */
  height?: number | null;
  /** Source image width in px (normalized here). */
  width?: number | null;
}): InferData {
  return [
    [buildGalleryItem(params.uploadedPath)],
    params.prompt,
    params.seed ?? 0,
    true, // randomize_seed
    4, // true_guidance_scale
    params.steps ?? 40, // num_inference_steps
    normalizeDimension(params.height),
    normalizeDimension(params.width),
    // rewrite_prompt: false — deliberate. Keep the user's exact instruction
    // (no silent prompt rewriting) and skip the extra rewriting latency.
    false,
  ];
}

/** Payload wrapper for POST /gradio_api/call/infer. */
export function buildCallPayload(params: Parameters<typeof buildInferData>[0]): {
  data: InferData;
} {
  return { data: buildInferData(params) };
}

/** Turn a result FileData into an absolute downloadable URL. */
export function resolveResultFileUrl(base: string, file: GradioFileData): string {
  if (file.url) {
    return file.url;
  }
  if (file.path) {
    return `${base}/gradio_api/file=${file.path}`;
  }
  throw new HfEditError('BAD_RESPONSE', HF_ERROR_MESSAGES.BAD_RESPONSE);
}

/** Map an HTTP status + body text from the Space onto a friendly error code. */
export function classifyHttpError(status: number, bodyText: string): HfEditError {
  const text = (bodyText ?? '').toLowerCase();
  if (
    text.includes('quota') ||
    text.includes('zerogpu') ||
    text.includes('gpu quota') ||
    text.includes('exceeded')
  ) {
    return new HfEditError('QUOTA', HF_ERROR_MESSAGES.QUOTA);
  }
  if (text.includes('queue') && (text.includes('full') || text.includes('limit'))) {
    return new HfEditError('QUEUE_FULL', HF_ERROR_MESSAGES.QUEUE_FULL);
  }
  if (status === 503 || text.includes('sleeping') || text.includes('restarting')) {
    return new HfEditError('SPACE_SLEEPING', HF_ERROR_MESSAGES.SPACE_SLEEPING);
  }
  if (status === 429) {
    return new HfEditError('QUOTA', HF_ERROR_MESSAGES.QUOTA);
  }
  return new HfEditError(
    'EDIT_FAILED',
    `${HF_ERROR_MESSAGES.EDIT_FAILED} (HTTP ${status})`,
  );
}

export interface SseMessage {
  event: string;
  data: unknown;
}

/** Parse an SSE response body into messages (pure; used for the result poll). */
export function parseSseMessages(text: string): SseMessage[] {
  const messages: SseMessage[] = [];
  const blocks = text.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }
    if (dataLines.length === 0) continue;
    const raw = dataLines.join('\n');
    let data: unknown = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      // keep as raw string — callers handle non-JSON heartbeats etc.
    }
    messages.push({ event, data });
  }
  return messages;
}

/** Unwrap one gallery entry: FileData, or {image: FileData, caption}. */
function fileDataFromGalleryItem(item: unknown): GradioFileData | null {
  if (typeof item !== 'object' || item === null) return null;
  const rec = item as Record<string, unknown>;
  if (typeof rec.path === 'string' || typeof rec.url === 'string') {
    return rec as GradioFileData;
  }
  const inner = rec.image;
  if (typeof inner === 'object' && inner !== null) {
    const innerRec = inner as Record<string, unknown>;
    if (typeof innerRec.path === 'string' || typeof innerRec.url === 'string') {
      return innerRec as GradioFileData;
    }
  }
  return null;
}

/**
 * Parse the `complete` event's data from /infer: a TUPLE
 * [resultGallery, seed] where resultGallery is a list of file objects.
 * Returns the first gallery image. (Also tolerates a bare gallery or a
 * single FileData, for robustness against Gradio shape drift.)
 */
export function resultFileFromCompleteData(data: unknown): GradioFileData {
  if (Array.isArray(data) && data.length > 0) {
    const first: unknown = data[0];
    // Tuple shape: data[0] is the result gallery (a list).
    if (Array.isArray(first)) {
      for (const item of first) {
        const file = fileDataFromGalleryItem(item);
        if (file) return file;
      }
    } else {
      const file = fileDataFromGalleryItem(first);
      if (file) return file;
    }
  }
  throw new HfEditError('BAD_RESPONSE', HF_ERROR_MESSAGES.BAD_RESPONSE);
}

/**
 * Extract the result FileData from the SSE messages of a finished call.
 * Throws a mapped HfEditError on error/heartbeat-only streams.
 */
export function extractResultFile(messages: SseMessage[]): GradioFileData {
  let lastError: string | null = null;
  for (const msg of messages) {
    if (msg.event === 'complete') {
      return resultFileFromCompleteData(msg.data);
    }
    if (msg.event === 'error') {
      lastError = typeof msg.data === 'string' ? msg.data : 'Unknown error';
    }
  }
  if (lastError) {
    return extractResultFileFromErrorText(lastError);
  }
  throw new HfEditError('BAD_RESPONSE', HF_ERROR_MESSAGES.BAD_RESPONSE);
}

function extractResultFileFromErrorText(text: string): never {
  const lower = text.toLowerCase();
  if (lower.includes('quota') || lower.includes('zerogpu')) {
    throw new HfEditError('QUOTA', HF_ERROR_MESSAGES.QUOTA);
  }
  if (lower.includes('queue')) {
    throw new HfEditError('QUEUE_FULL', HF_ERROR_MESSAGES.QUEUE_FULL);
  }
  throw new HfEditError('EDIT_FAILED', `${HF_ERROR_MESSAGES.EDIT_FAILED} (${text})`);
}

export interface EditImageOptions {
  /** Raw Space URL from Settings/env (validated by buildSpaceBaseUrl). */
  spaceUrl: string | null | undefined;
  /** Optional HF token (from SecureStore). */
  token?: string | null;
  /** Local file uri of the photo to edit. */
  imageUri: string;
  prompt: string;
  seed?: number;
  steps?: number;
  /** Source image height in px; normalized (clamp/round) before sending. */
  height?: number | null;
  /** Source image width in px; normalized (clamp/round) before sending. */
  width?: number | null;
  /** Overall deadline for the whole flow, ms. Default 5 minutes. */
  timeoutMs?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchFn?: typeof fetch;
  /** Injectable for tests. Creates the multipart body for the upload. */
  buildUploadBody?: (imageUri: string) => unknown;
}

export interface EditImageResult {
  /** Absolute URL the edited image can be downloaded from (token header needed if private). */
  resultUrl: string;
  resultFile: GradioFileData;
}

function defaultUploadBody(imageUri: string): unknown {
  // React Native FormData file part.
  const form = new FormData();
  const name = imageUri.split('/').pop() ?? 'photo.jpg';
  form.append('files', {
    uri: imageUri,
    name,
    type: 'image/jpeg',
  } as unknown as Blob);
  return form;
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new HfEditError('TIMEOUT', HF_ERROR_MESSAGES.TIMEOUT);
    }
    throw new HfEditError('NETWORK', HF_ERROR_MESSAGES.NETWORK);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run one prompt edit against the configured Space and return the result URL.
 * The caller downloads + persists the file (see storage.ts) so this module
 * stays free of native file-system imports.
 */
export async function editImageWithPrompt(
  options: EditImageOptions,
): Promise<EditImageResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const base = buildSpaceBaseUrl(options.spaceUrl);
  const headers = authHeaders(options.token);

  // 1) Upload the photo.
  const uploadBody = (options.buildUploadBody ?? defaultUploadBody)(options.imageUri);
  const uploadRes = await fetchWithTimeout(
    fetchFn,
    buildUploadUrl(base),
    {
      method: 'POST',
      headers,
      body: uploadBody as BodyInit,
    },
    timeoutMs,
  );
  if (!uploadRes.ok) {
    throw classifyHttpError(uploadRes.status, await safeText(uploadRes));
  }
  const uploadJson: unknown = await safeJson(uploadRes);
  if (
    !Array.isArray(uploadJson) ||
    uploadJson.length === 0 ||
    typeof uploadJson[0] !== 'string'
  ) {
    throw new HfEditError('BAD_RESPONSE', HF_ERROR_MESSAGES.BAD_RESPONSE);
  }
  const uploadedPath: string = uploadJson[0];

  // 2) Start the prediction.
  const callRes = await fetchWithTimeout(
    fetchFn,
    buildCallUrl(base),
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildCallPayload({
          uploadedPath,
          prompt: options.prompt,
          seed: options.seed,
          steps: options.steps,
          height: options.height,
          width: options.width,
        }),
      ),
    },
    timeoutMs,
  );
  if (!callRes.ok) {
    throw classifyHttpError(callRes.status, await safeText(callRes));
  }
  const callJson: unknown = await safeJson(callRes);
  const eventId =
    typeof callJson === 'object' && callJson !== null
      ? (callJson as Record<string, unknown>).event_id
      : undefined;
  if (typeof eventId !== 'string' || !eventId) {
    throw new HfEditError('BAD_RESPONSE', HF_ERROR_MESSAGES.BAD_RESPONSE);
  }

  // 3) Read the SSE stream until the job completes (or the deadline hits).
  const deadline = Date.now() + timeoutMs;
  let resultFile: GradioFileData | null = null;
  while (Date.now() < deadline && resultFile === null) {
    const statusRes = await fetchWithTimeout(
      fetchFn,
      buildStatusUrl(base, eventId),
      { method: 'GET', headers },
      Math.max(1000, deadline - Date.now()),
    );
    if (!statusRes.ok) {
      throw classifyHttpError(statusRes.status, await safeText(statusRes));
    }
    const sseText = await safeText(statusRes);
    const messages = parseSseMessages(sseText);
    const hasComplete = messages.some((m) => m.event === 'complete');
    const hasError = messages.some((m) => m.event === 'error');
    if (hasComplete || hasError) {
      resultFile = extractResultFile(messages);
    }
    // Otherwise the stream closed early (proxy timeout etc.) — poll again.
  }
  if (resultFile === null) {
    throw new HfEditError('TIMEOUT', HF_ERROR_MESSAGES.TIMEOUT);
  }

  return { resultUrl: resolveResultFileUrl(base, resultFile), resultFile };
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
