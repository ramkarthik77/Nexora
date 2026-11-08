# Nexora — Cloudflare Worker GitHub Issue Demo

A minimal, GitHub-first agentic AEM analysis demo. GitHub sends `issues.opened` → Cloudflare Worker checks HMAC-SHA256 → normalizes to a portable event → routes to **aem-dev-agent** (bugs/default) or **aem-assistant** (questions) → fetches up to five relevant AEM project files using the GitHub REST API → adds a **synthetic** AEM/Splunk-style log → calls Claude for validated JSON → posts an issue comment and adds `nexora-analyzed`.

**No PR creation, code writes, deployment, real Splunk, dashboard, or queues.** The GitHub publisher is the only module with GitHub write API calls.

## Requirements

- Node.js 20+, npm, Cloudflare account with Workers and KV access, Anthropic API key.
- A GitHub repo with an archetype-style AEMaaCS project (the webhook may target another repo; the files are fetched from that configured repo).
- A **fine-grained PAT limited to the target repo**, with **Issues: Read and write**, **Contents: Read-only**, and Metadata read (automatic). Avoid workflow/administration permissions.
- A webhook secret (`openssl rand -hex 32`).

> **Data disclosure:** Issue bodies, selected source files, and the bundled sample log are sent to Anthropic. Use a repo approved for that disclosure; avoid proprietary code and personal information in an unrestricted demo. No real production logs are fetched.

## 1. Install and configure

```bash
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars locally (never commit it):
# GITHUB_WEBHOOK_SECRET, GITHUB_TOKEN, ANTHROPIC_API_KEY
```

Edit `wrangler.toml`:

```toml
[vars]
GITHUB_REPO = "your-org/your-aem-repo"
CLAUDE_MODEL = "claude-sonnet-4-5"  # or another supported structured-output Claude model
```

Choose the **exact** repo that will send the webhook. The Worker rejects events from other repos, even when they have a valid HMAC signature.

## 2. Configure KV

```bash
npx wrangler login
npx wrangler kv namespace create DELIVERIES
```

Copy the returned namespace ID into the `[[kv_namespaces]]` entry in `wrangler.toml`, replacing the all-zero placeholder. Wrangler local development uses local KV storage, so the placeholder also works for quick local tests before creating a remote namespace. See [Cloudflare KV binding instructions](https://developers.cloudflare.com/kv/get-started/).

## 3. Run locally

```bash
npm run check
npm test
npm run dev
# Health endpoint:
curl http://127.0.0.1:8787/health
```

### Send a signed example request with curl

First create a real GitHub issue (see below), and set its number. The replay script uses Node crypto **only in the local developer script**, not in the Worker.

```bash
export GITHUB_REPO="your-org/your-aem-repo"
export ISSUE_NUMBER="142"                 # MUST be an existing issue in that repo
export GITHUB_WEBHOOK_SECRET="your-webhook-secret"
node scripts/prepare-replay.mjs

curl -i http://127.0.0.1:8787/webhooks/github \
  -H 'Content-Type: application/json' \
  -H 'X-GitHub-Event: issues' \
  -H "X-GitHub-Delivery: $(cat .tmp/delivery-id.txt)" \
  -H "X-Hub-Signature-256: $(cat .tmp/signature.txt)" \
  --data-binary @.tmp/webhook.json
# HTTP/1.1 202 Accepted
```

The replay updates the sample payload with your repo and real issue number. The GitHub API token still needs permission to comment and label that issue. Run the same `curl` command again to demonstrate KV duplicate detection; create a new fixture to create a new delivery ID. If the issue number does not exist, publication fails after the 202 response; check Wrangler logs.

**Important:** Local Wrangler `.dev.vars` takes precedence over deployed secrets. Use a unique test issue. If replaying the same fixture as the real webhook, the delivery IDs differ and Nexora may create separate comments.

## 4. Deploy to Cloudflare

Store the three secrets without checking them into git:

```bash
npx wrangler secret put GITHUB_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

The deployed URL should be similar to:

```text
https://nexora-cloudflare-demo.<your-subdomain>.workers.dev/webhooks/github
```

Do **not** rely on that example URL. Copy the exact Worker URL from Wrangler's deployment output.

## 5. Configure GitHub webhook

In the **target AEM repository**: **Settings → Webhooks → Add webhook**.

- Payload URL: the deployed Worker URL with `/webhooks/github`
- Content type: `application/json`
- Secret: exactly `GITHUB_WEBHOOK_SECRET` used by Worker
- Events: **Let me select individual events → Issues** only
- Active: enabled

In **Settings → Labels**, create `nexora-analyzed` if absent. Do not give the demo access to the GitHub workflow or administration permissions.

Open a new issue. In GitHub **Settings → Webhooks → Recent Deliveries**, the response should be **202**, with `accepted: true`. The issue comment appears asynchronously if the Worker finishes. Use `npx wrangler tail` for logs after deployment.

## Demo issue

**Title:** `Hero component shows blank on publish after deploy`

**Labels:** `bug`

**Body:**

> After deploying the latest AEM as a Cloud Service release to STAGE, the homepage hero is blank on publish, but it looks correct on author. The component uses a `HeroModel` Sling Model and a `ui.apps` hero component. Could this be a missing `assetPath` injection? Request ID `demo-hero-142`.

The bundled mock AEM error log contains a synthetic `ModelAdapterFactory` missing-injection entry for `HeroModel.assetPath`. If matching project files exist, the Worker fetches up to five (source code, HTL, OSGi/Dispatcher configuration) and sends excerpts to Claude. Model output may vary. See [`example-bot-comment.md`](./example-bot-comment.md) for an illustrative Markdown response.

To demonstrate question routing, create an issue titled `How should OSGi configs be organized in AEMaaCS?` with label `question` and **no** `bug` label.

## Design and portability

```text
src/
  index.ts                 Cloudflare-only HTTP adapter, KV, waitUntil
  ingest/verify.ts         Web Crypto HMAC validation (portable)
  ingest/normalize.ts      Zod-validated GitHub event normalization
  events/canonical.ts      Canonical issue event
  router/router.ts         Deterministic agent routing
  agents/types.ts          Agent interface + Zod result schema
  agents/aemDevAgent.ts    Developer investigation prompt
  agents/aemAssistant.ts   AEM question prompt
  agents/anthropic.ts      Anthropic Messages fetch adapter
  tools/github.ts          Read-only repo retrieval; shared authenticated fetch
  tools/splunkMock.ts      Mock log port
  publisher/github.ts      Only module that writes to GitHub
  sample/aem-error-log.ts  Synthetic AEM publish-tier error log
scripts/prepare-replay.mjs  Developer-only fixture signer
sample-issue-opened.json   Example webhook
example-bot-comment.md    Example report
```

The event, router, agents, tools, and publisher use only standard TypeScript and web-compatible APIs, not Cloudflare bindings. On AWS, replace the adapter in `src/index.ts` with Lambda, SQS message handling, or Step Functions activities. The rule router and contracts remain unchanged. The Claude provider and GitHub tools can be reused until a containerized Agent SDK replacement is introduced.

## Demo limitations to disclose

1. **`waitUntil()` is bounded, not durable.** Cloudflare permits approximately **30 seconds after HTTP response** for background promises. This demo caps its work to 24 seconds to leave time for cleanup. Slower Claude/GitHub operations can still fail, and returning 202 does not guarantee eventual completion. Check logs and manually redeliver failures. For production, use Cloudflare Queues/Workflows (or AWS SQS and Step Functions).
2. **Workers KV is eventually consistent and has no atomic check-and-set.** It provides only **best-effort** duplicate suppression; simultaneous deliveries to different regions can run twice. The publisher also checks for a delivery marker in issue comments, but that check is not atomic either. Move to Durable Objects/D1 uniqueness (or DynamoDB conditional writes) when stronger idempotency is required.
3. **GitHub Contents fetch is intentionally bounded.** The repository tree can be truncated on very large repos. Candidates are filtered to AEM modules, extension/size/path limits, then ranked by issue keywords. No semantic index or full RAG is included.
4. **No real investigation tools.** The sample log is fabricated for a realistic demo. The issue comment explicitly identifies it as synthetic data. Model analysis is a hypothesis, not a verified fix.
5. **No auto-retry.** A 202 acknowledgment means GitHub will not automatically retry after a later asynchronous failure. Production must add a durable queue and DLQ.
6. **Read-only analysis, limited publishing.** The PAT can post a comment and add a label. Keep its repository scope restricted, protect it in Workers Secrets, and rotate it when needed.

## Migration next steps: AWS

| Cloudflare demo | AWS production target |
|---|---|
| Worker fetch handler | API Gateway + Lambda verification |
| `ctx.waitUntil()` | SQS trigger + Step Functions Standard |
| KV delivery IDs | DynamoDB conditional idempotency + execution state |
| Rule router / canonical event | **Keep as-is** in shared TS package |
| Claude Messages fetch | Claude Agent SDK running in ECS Fargate |
| Mock log reader | Splunk REST query adapter with bounded SPL |
| Fine-grained PAT | Repository-scoped GitHub App installation token |
| Comment + label publisher | Governed publisher; later draft PR support |
| Wrangler logs | CloudWatch traces, audit events and dashboard |

For the GitHub App migration, use an installation token with **Issues write** (comments/labels) and **Contents read** for retrieval. Only add **Contents/Pull requests write** when draft-PR workflows are separately approved. Remove the PAT secret after cutover.
