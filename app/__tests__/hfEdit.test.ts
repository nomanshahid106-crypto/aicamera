import {
  API_NAME,
  DEFAULT_SPACE_URL,
  HfEditError,
  authHeaders,
  buildCallPayload,
  buildCallUrl,
  buildGalleryItem,
  buildInferData,
  buildSpaceBaseUrl,
  buildStatusUrl,
  buildUploadUrl,
  classifyHttpError,
  editImageWithPrompt,
  extractResultFile,
  isSpaceConfigured,
  normalizeDimension,
  parseSseMessages,
  resolveResultFileUrl,
  resolveSpaceUrl,
  resultFileFromCompleteData,
} from '../src/lib/hfEdit';

const BASE = 'https://user-promptcam-engine.hf.space';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error('not json');
    },
    text: async () => body,
  } as unknown as Response;
}

describe('space URL builders', () => {
  it('buildSpaceBaseUrl trims whitespace and trailing slashes', () => {
    expect(buildSpaceBaseUrl('  https://a.hf.space/// ')).toBe('https://a.hf.space');
  });

  it('buildSpaceBaseUrl throws NOT_CONFIGURED for empty input', () => {
    for (const raw of ['', '   ', null, undefined]) {
      try {
        buildSpaceBaseUrl(raw);
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HfEditError);
        expect((e as HfEditError).code).toBe('NOT_CONFIGURED');
      }
    }
    expect(isSpaceConfigured('')).toBe(false);
    expect(isSpaceConfigured(BASE)).toBe(true);
  });

  it('buildSpaceBaseUrl throws INVALID_URL for garbage and non-http schemes', () => {
    for (const raw of ['not a url', 'ftp://x.hf.space']) {
      try {
        buildSpaceBaseUrl(raw);
        throw new Error('should have thrown');
      } catch (e) {
        expect((e as HfEditError).code).toBe('INVALID_URL');
      }
    }
  });

  it('builds upload / call / status URLs from the API_NAME constant', () => {
    expect(API_NAME).toBe('infer');
    expect(buildUploadUrl(BASE)).toBe(`${BASE}/gradio_api/upload`);
    expect(buildCallUrl(BASE)).toBe(`${BASE}/gradio_api/call/infer`);
    expect(buildStatusUrl(BASE, 'evt123')).toBe(
      `${BASE}/gradio_api/call/infer/evt123`,
    );
  });

  it('DEFAULT_SPACE_URL is Qwen official public Space', () => {
    expect(DEFAULT_SPACE_URL).toBe('https://qwen-qwen-image-edit-2511.hf.space');
  });

  it('resolveSpaceUrl prefers Settings, then env, then the built-in default', () => {
    expect(
      resolveSpaceUrl({
        settingsUrl: ' https://s.hf.space ',
        envUrl: 'https://e.hf.space',
      }),
    ).toBe('https://s.hf.space');
    expect(resolveSpaceUrl({ settingsUrl: '', envUrl: 'https://e.hf.space' })).toBe(
      'https://e.hf.space',
    );
    expect(resolveSpaceUrl({ settingsUrl: null, envUrl: undefined })).toBe(
      DEFAULT_SPACE_URL,
    );
    expect(resolveSpaceUrl({})).toBe(DEFAULT_SPACE_URL);
  });
});

describe('payloads and headers', () => {
  it('buildGalleryItem wraps the upload as a gallery item with null caption', () => {
    expect(buildGalleryItem('/tmp/gradio/photo.jpg')).toEqual({
      image: { path: '/tmp/gradio/photo.jpg', meta: { _type: 'gradio.FileData' } },
      caption: null,
    });
  });

  it('buildInferData sends the exact 9-element /infer data array', () => {
    const data = buildInferData({
      uploadedPath: '/tmp/gradio/photo.jpg',
      prompt: 'make it cinematic',
      seed: 7,
      steps: 30,
      height: 1200,
      width: 900,
    });
    expect(data).toEqual([
      [
        {
          image: {
            path: '/tmp/gradio/photo.jpg',
            meta: { _type: 'gradio.FileData' },
          },
          caption: null,
        },
      ],
      'make it cinematic',
      7,
      true, // randomize_seed
      4, // true_guidance_scale
      30, // num_inference_steps
      1200, // height (already a multiple of 16)
      896, // width 900 rounded to a multiple of 16
      false, // rewrite_prompt
    ]);
    expect(data).toHaveLength(9);
  });

  it('buildInferData defaults seed 0, randomize true, guidance 4, steps 40, dims 1024', () => {
    const data = buildInferData({ uploadedPath: '/tmp/x.jpg', prompt: 'hi' });
    expect(data[2]).toBe(0);
    expect(data[3]).toBe(true);
    expect(data[4]).toBe(4);
    expect(data[5]).toBe(40);
    expect(data[6]).toBe(1024);
    expect(data[7]).toBe(1024);
    expect(data[8]).toBe(false);
  });

  it('buildCallPayload wraps buildInferData', () => {
    const payload = buildCallPayload({ uploadedPath: '/tmp/x.jpg', prompt: 'hi' });
    expect(payload.data).toEqual(
      buildInferData({ uploadedPath: '/tmp/x.jpg', prompt: 'hi' }),
    );
  });

  it('normalizeDimension clamps to 256-2048 and rounds to a multiple of 16', () => {
    expect(normalizeDimension(1024)).toBe(1024);
    expect(normalizeDimension(100)).toBe(256);
    expect(normalizeDimension(3000)).toBe(2048);
    expect(normalizeDimension(1000)).toBe(1008);
    expect(normalizeDimension(900)).toBe(896);
  });

  it('normalizeDimension falls back to 1024 for missing/invalid values', () => {
    expect(normalizeDimension(undefined)).toBe(1024);
    expect(normalizeDimension(null)).toBe(1024);
    expect(normalizeDimension(0)).toBe(1024);
    expect(normalizeDimension(-5)).toBe(1024);
    expect(normalizeDimension(Number.NaN)).toBe(1024);
  });

  it('authHeaders only includes Authorization when a token is set', () => {
    expect(authHeaders()).toEqual({});
    expect(authHeaders('')).toEqual({});
    expect(authHeaders('  ')).toEqual({});
    expect(authHeaders(' hf_abc ')).toEqual({ Authorization: 'Bearer hf_abc' });
  });

  it('resolveResultFileUrl prefers url and falls back to /gradio_api/file=', () => {
    expect(resolveResultFileUrl(BASE, { url: 'https://x/y.png' })).toBe('https://x/y.png');
    expect(resolveResultFileUrl(BASE, { path: '/tmp/out.png' })).toBe(
      `${BASE}/gradio_api/file=/tmp/out.png`,
    );
    expect(() => resolveResultFileUrl(BASE, {})).toThrow(HfEditError);
  });
});

describe('error mapping', () => {
  it('classifyHttpError maps quota text and 429 to QUOTA', () => {
    expect(classifyHttpError(500, 'ZeroGPU quota exceeded').code).toBe('QUOTA');
    expect(classifyHttpError(429, 'rate limited').code).toBe('QUOTA');
  });

  it('classifyHttpError maps queue full and 503 to friendly codes', () => {
    expect(classifyHttpError(500, 'Queue full, try later').code).toBe('QUEUE_FULL');
    expect(classifyHttpError(503, '').code).toBe('SPACE_SLEEPING');
    expect(classifyHttpError(500, 'boom').code).toBe('EDIT_FAILED');
  });
});

describe('SSE parsing', () => {
  it('parseSseMessages parses event/data blocks and JSON payloads', () => {
    const text =
      'event: heartbeat\n' +
      'data: {"msg": "hi"}\n\n' +
      'event: complete\n' +
      'data: [[{"path": "/tmp/out.png"}], 12345]\n\n';
    const msgs = parseSseMessages(text);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.event).toBe('heartbeat');
    expect(msgs[1]?.event).toBe('complete');
    expect(extractResultFile(msgs)).toEqual({ path: '/tmp/out.png' });
  });

  it('resultFileFromCompleteData parses the [gallery, seed] tuple', () => {
    expect(
      resultFileFromCompleteData([
        [{ url: 'https://x/out.png', path: '/tmp/out.png' }],
        777,
      ]),
    ).toEqual({ url: 'https://x/out.png', path: '/tmp/out.png' });
  });

  it('resultFileFromCompleteData unwraps {image, caption} gallery items', () => {
    expect(
      resultFileFromCompleteData([
        [{ image: { path: '/tmp/wrapped.png' }, caption: null }],
        1,
      ]),
    ).toEqual({ path: '/tmp/wrapped.png' });
  });

  it('resultFileFromCompleteData throws BAD_RESPONSE on an empty gallery', () => {
    expect(() => resultFileFromCompleteData([[], 1])).toThrow(HfEditError);
    expect(() => resultFileFromCompleteData(null)).toThrow(HfEditError);
  });

  it('extractResultFile throws BAD_RESPONSE when stream ends without complete', () => {
    const msgs = parseSseMessages('event: heartbeat\ndata: {}\n\n');
    expect(() => extractResultFile(msgs)).toThrow(HfEditError);
  });
});

describe('editImageWithPrompt (mocked fetch)', () => {
  const sseComplete =
    'event: complete\n' +
    'data: [[{"url": "https://user-promptcam-engine.hf.space/gradio_api/file=/tmp/out.png", "path": "/tmp/out.png"}], 4242]\n\n';

  function happyFetch(): typeof fetch {
    return jest.fn(async (url: string) => {
      if (url.endsWith('/gradio_api/upload')) {
        return jsonResponse(['/tmp/gradio/uploaded.jpg']);
      }
      if (url.endsWith('/gradio_api/call/infer')) {
        return jsonResponse({ event_id: 'evt-1' });
      }
      if (url.includes('/gradio_api/call/infer/evt-1')) {
        return textResponse(sseComplete);
      }
      throw new Error(`Unexpected URL ${url}`);
    }) as unknown as typeof fetch;
  }

  it('runs upload -> call -> poll and returns the result URL', async () => {
    const fetchFn = happyFetch();
    const result = await editImageWithPrompt({
      spaceUrl: `${BASE}/`,
      imageUri: 'file:///photo.jpg',
      prompt: 'change background to a beach',
      fetchFn,
      buildUploadBody: () => 'fake-body',
    });
    expect(result.resultUrl).toContain('/gradio_api/file=/tmp/out.png');
    const calls = (fetchFn as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(calls[0]).toBe(`${BASE}/gradio_api/upload`);
    expect(calls[1]).toBe(`${BASE}/gradio_api/call/infer`);
    expect(calls[2]).toBe(`${BASE}/gradio_api/call/infer/evt-1`);
    // The call payload is the exact 9-element /infer array.
    const callInit = (fetchFn as jest.Mock).mock.calls[1]?.[1] as RequestInit;
    const sent = JSON.parse(callInit.body as string) as { data: unknown[] };
    expect(sent.data).toHaveLength(9);
    expect(sent.data[0]).toEqual([
      {
        image: {
          path: '/tmp/gradio/uploaded.jpg',
          meta: { _type: 'gradio.FileData' },
        },
        caption: null,
      },
    ]);
    expect(sent.data[1]).toBe('change background to a beach');
    expect(sent.data[2]).toBe(0);
    expect(sent.data[3]).toBe(true);
    expect(sent.data[4]).toBe(4);
    expect(sent.data[5]).toBe(40);
    expect(sent.data[6]).toBe(1024);
    expect(sent.data[7]).toBe(1024);
    expect(sent.data[8]).toBe(false);
  });

  it('passes source dimensions (normalized) into the payload', async () => {
    const fetchFn = happyFetch();
    await editImageWithPrompt({
      spaceUrl: BASE,
      imageUri: 'file:///photo.jpg',
      prompt: 'hi',
      width: 900,
      height: 1200,
      fetchFn,
      buildUploadBody: () => 'fake-body',
    });
    const callInit = (fetchFn as jest.Mock).mock.calls[1]?.[1] as RequestInit;
    const sent = JSON.parse(callInit.body as string) as { data: unknown[] };
    expect(sent.data[6]).toBe(1200);
    expect(sent.data[7]).toBe(896);
  });

  it('sends the Authorization header when a token is provided', async () => {
    const fetchFn = happyFetch();
    await editImageWithPrompt({
      spaceUrl: BASE,
      token: 'hf_secret_token',
      imageUri: 'file:///photo.jpg',
      prompt: 'hi',
      fetchFn,
      buildUploadBody: () => 'fake-body',
    });
    for (const call of (fetchFn as jest.Mock).mock.calls) {
      const init = call[1] as RequestInit;
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer hf_secret_token',
      );
    }
  });

  it('throws NOT_CONFIGURED before any network call when no Space URL is set', async () => {
    const fetchFn = jest.fn() as unknown as typeof fetch;
    await expect(
      editImageWithPrompt({
        spaceUrl: '',
        imageUri: 'file:///photo.jpg',
        prompt: 'hi',
        fetchFn,
      }),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('maps an SSE error event about quota to QUOTA', async () => {
    const fetchFn = jest.fn(async (url: string) => {
      if (url.endsWith('/gradio_api/upload')) return jsonResponse(['/tmp/u.jpg']);
      if (url.endsWith('/gradio_api/call/infer')) {
        return jsonResponse({ event_id: 'evt-2' });
      }
      return textResponse('event: error\ndata: "ZeroGPU quota exhausted"\n\n');
    }) as unknown as typeof fetch;
    await expect(
      editImageWithPrompt({
        spaceUrl: BASE,
        imageUri: 'file:///photo.jpg',
        prompt: 'hi',
        fetchFn,
        buildUploadBody: () => 'fake-body',
      }),
    ).rejects.toMatchObject({ code: 'QUOTA' });
  });

  it('maps a network failure on upload to NETWORK', async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error('socket hangup');
    }) as unknown as typeof fetch;
    await expect(
      editImageWithPrompt({
        spaceUrl: BASE,
        imageUri: 'file:///photo.jpg',
        prompt: 'hi',
        fetchFn,
        buildUploadBody: () => 'fake-body',
      }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
