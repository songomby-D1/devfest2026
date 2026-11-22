import { describe, expect, it } from 'vitest';
import { HttpMeshyClient, MeshyError } from './meshy-client.js';

interface Call {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function clientAnswering(response: () => Response): {
  client: HttpMeshyClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  const client = new HttpMeshyClient({
    baseUrl: 'https://api.meshy.ai',
    apiKey: 'msy_test-key',
    timeoutMs: 1000,
    downloadTimeoutMs: 1000,
    fetch: (input, init) => {
      calls.push({
        url: input instanceof Request ? input.url : input.toString(),
        init,
      });
      return Promise.resolve(response());
    },
  });
  return { client, calls };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('HttpMeshyClient', () => {
  it('creates an image-to-3D task with a bearer key and a textured GLB request', async () => {
    const { client, calls } = clientAnswering(() => json({ result: 'abc' }));
    await expect(
      client.createImageTo3d({
        imageDataUri: 'data:image/png;base64,AAAA',
        texturePrompt: 'raffia',
      }),
    ).resolves.toBe('abc');
    const call = calls[0];
    expect(call?.url).toBe('https://api.meshy.ai/openapi/v1/image-to-3d');
    expect(new Headers(call?.init?.headers).get('authorization')).toBe(
      'Bearer msy_test-key',
    );
    expect(JSON.parse(call?.init?.body as string)).toMatchObject({
      image_url: 'data:image/png;base64,AAAA',
      should_texture: true,
      target_formats: ['glb'],
      texture_prompt: 'raffia',
    });
  });

  it('maps a task answer and tolerates missing optional fields', async () => {
    const { client } = clientAnswering(() =>
      json({
        id: 'abc',
        status: 'SUCCEEDED',
        progress: 100,
        model_urls: { glb: 'https://assets.meshy.ai/a.glb' },
      }),
    );
    await expect(client.getImageTo3d('abc')).resolves.toEqual({
      id: 'abc',
      status: 'SUCCEEDED',
      progress: 100,
      glbUrl: 'https://assets.meshy.ai/a.glb',
      thumbnailUrl: null,
      errorCode: null,
    });
  });

  it.each([
    [402, 'credits'],
    [429, 'busy'],
    [400, 'rejected'],
    [401, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, failure) => {
    const { client } = clientAnswering(() => json({ message: 'x' }, status));
    await expect(client.getImageTo3d('abc')).rejects.toMatchObject({
      failure,
    });
  });

  it('refuses to download from a host other than Meshy', async () => {
    const { client, calls } = clientAnswering(() => new Response('x'));
    await expect(
      client.download('https://evil.example/model.glb', 10),
    ).rejects.toBeInstanceOf(MeshyError);
    expect(calls).toHaveLength(0);
  });

  it('refuses a download over the size cap', async () => {
    const { client } = clientAnswering(() => new Response('0123456789ABC'));
    await expect(
      client.download('https://assets.meshy.ai/a.glb', 10),
    ).rejects.toMatchObject({ failure: 'rejected' });
  });
});
