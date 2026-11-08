import { verifyGithubSignature } from './ingest/verify';
import { normalizeGithubIssueOpened } from './ingest/normalize';
import { routeIssue } from './router/router';
import { aemDevAgent } from './agents/aemDevAgent';
import { aemAssistant } from './agents/aemAssistant';
import { createAnthropicClient } from './agents/anthropic';
import { readRelevantRepoFiles } from './tools/github';
import { splunkMock } from './tools/splunkMock';
import { publishGithubAnalysis } from './publisher/github';
import type { CanonicalIssueOpened } from './events/canonical';

interface Env {
  DELIVERIES: KVNamespace;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  GITHUB_REPO: string;
  CLAUDE_MODEL: string;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function processEvent(event: CanonicalIssueOpened, env: Env): Promise<void> {
  const kvKey = `delivery:${event.source.deliveryId}`;
  // Cloudflare waitUntil() has a ~30s post-response wall-time cap.
  // Use a tighter deadline so individual fetches fail instead of hanging indefinitely.
  const signal = AbortSignal.timeout(24_000);
  try {
    const agentId = routeIssue(event);
    const agent = agentId === 'aem-assistant' ? aemAssistant : aemDevAgent;
    const [files, mockLog] = await Promise.all([
      readRelevantRepoFiles(event, env.GITHUB_TOKEN, signal),
      splunkMock.getRelevantLog(),
    ]);
    const claude = createAnthropicClient(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL);
    const analysis = await agent.execute({ event, files, mockLog, claude, signal });
    await publishGithubAnalysis(event, agentId, analysis, files.map((f) => f.path), env.GITHUB_TOKEN, signal);
    await env.DELIVERIES.put(kvKey, 'done', { expirationTtl: 7 * 24 * 3600 });
    console.log(JSON.stringify({ eventId: event.eventId, agentId, state: 'done', files: files.length }));
  } catch (error) {
    console.error(JSON.stringify({ eventId: event.eventId, state: 'failed', error: error instanceof Error ? error.message : 'unknown error' }));
    // Enables an operator to manually redeliver after errors. GitHub already got 202;
    // webhook auto-retry is NOT guaranteed: check wrangler logs after a failed run.
    await env.DELIVERIES.delete(kvKey).catch(() => {});
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json({ service: 'nexora-demo', status: 'ok' }, 200);
    if (url.pathname !== '/webhooks/github') return json({ error: 'Not found' }, 404);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!env.GITHUB_WEBHOOK_SECRET || !env.GITHUB_TOKEN || !env.ANTHROPIC_API_KEY || !env.GITHUB_REPO || !env.CLAUDE_MODEL) {
      return json({ error: 'Worker is not configured' }, 503);
    }
    if (Number(request.headers.get('content-length') ?? '0') > 256_000) return json({ error: 'Payload too large' }, 413);
    const bodyBytes = new Uint8Array(await request.arrayBuffer());
    if (bodyBytes.length > 256_000) return json({ error: 'Payload too large' }, 413);
    if (!(await verifyGithubSignature(bodyBytes, request.headers.get('x-hub-signature-256'), env.GITHUB_WEBHOOK_SECRET))) {
      return json({ error: 'Invalid signature' }, 401);
    }
    if (request.headers.get('x-github-event') !== 'issues') return json({ ignored: 'unsupported event' }, 200);
    const deliveryId = request.headers.get('x-github-delivery') ?? '';
    if (!/^[a-z0-9-]{12,100}$/i.test(deliveryId)) return json({ error: 'Invalid delivery ID' }, 400);
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes)); }
    catch { return json({ error: 'Invalid UTF-8 JSON' }, 400); }
    if ((payload as { action?: string })?.action !== 'opened') return json({ ignored: 'only issues.opened' }, 200);
    let event: CanonicalIssueOpened;
    try { event = normalizeGithubIssueOpened(payload, deliveryId); }
    catch { return json({ error: 'Invalid GitHub issue payload' }, 400); }
    if (event.repository.fullName.toLowerCase() !== env.GITHUB_REPO.toLowerCase()) return json({ error: 'Repository not allowed' }, 403);
    const kvKey = `delivery:${deliveryId}`;
    if (await env.DELIVERIES.get(kvKey)) return json({ accepted: true, duplicate: true, eventId: event.eventId }, 202);
    // Best-effort KV dedup: get+put is NOT atomic, and KV is eventually consistent.
    await env.DELIVERIES.put(kvKey, 'processing', { expirationTtl: 7 * 24 * 3600 });
    ctx.waitUntil(processEvent(event, env));
    return json({ accepted: true, duplicate: false, eventId: event.eventId }, 202);
  },
} satisfies ExportedHandler<Env>;
