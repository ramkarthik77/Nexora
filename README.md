# Nexora Spatial — Cloudflare AI Command Center

**Status:** Cloudflare-hosted Nexora mock prototype, with an independent animated humanoid and browser-native scripted voice demo. Adobe Cloud Manager read-only connector is present but **not authenticated against a real Adobe tenant**.

This is an independently created spatial AI UI, not Ruturaj's NEXUS or Reznikov Engineering's Apex source code or artwork. The current particle *orb* is original; a production-grade rigged 3D humanoid, phoneme-accurate lip sync, 3D gesture tracking, and production agent actions remain future work. Name and brand should receive a trademark review before commercial use.

## What works now

- Responsive spatial UI: animated particle orb, seven modules, grid/focus/spatial controls, inspector, command drawer, browser speech recognition/synthesis where supported.
- Mock AEM Cloud module: **120 entirely invented sites**, 3 environments, synthetic pipeline executions, healthy/degraded/incident scenarios, alert display and explicit `UNKNOWN` rollback count.
- Read-only Adobe Cloud Manager API adapter: OAuth Server-to-Server authentication, program/environment/pipeline discovery and bounded recent pipeline execution history. Default mode is `mock`; enterprise mode requires additional explicit safeguards.
- Optional server-side HTTP HEAD checks against a company-approved inventory, max 20 per request (availability signals, not full AEM health or site discovery).
- Public GitHub profile lookup, opt-in weather, browser diagnostics, local notes/calendar, optional Claude assistant (Gemini fallback also supported) using a Worker secret.
- Node unit/integration tests include fake Adobe OAuth/API exchange and five deterministic mock conversation fixtures; Playwright validates avatar/demo paths in GitHub Actions.


## Test an interactive talking avatar without Claude

The default **CINEMATIC** humanoid now includes an independent Canvas 2D face-motion layer over the original artwork: periodic eye blinks, ambient head/shoulder movement, pointer-controlled pose, and **approximate** mouth motion during replies. The separate **3D PARTICLES** mode remains available. This is not full facial rigging, motion capture, or phoneme-exact lip sync.

Click **TEST VOICE CONVERSATION** on the humanoid screen. The five on-screen questions are:

1. **Who are you?**
2. **How many AEM sites do you monitor?**
3. **How many production deployments happened this quarter?**
4. **Can you show me an incident?**
5. **Can you hear me and talk back?**

Each returns a deterministic locally scripted reply (see `public/mock-conversation.js`) with absolutely **no AI API call**. Replies use your browser's `speechSynthesis` if supported; controls include **VOICE ON/OFF**, **REPLAY**, and **STOP**. You can also type one of these questions into the main command field, or use the microphone in browsers offering Web Speech recognition. **Microphone permission is optional** and speech recognition may be unavailable; scripted question buttons always work without mic permission. Toggle voice off for silent tests. The first answer is always a demonstration, never a real platform status assertion.

For testing offline, `npm run preview` serves the same static UI with a local mock `/api/health` and `/api/aem/overview`. No Claude Code session, ANTHROPIC_API_KEY, Adobe account, or enterprise data is necessary.

**Security:** Browser voice synthesis is local to the browser interface, but the underlying voice engine and speech recognition implementation vary by operating system/browser and may use platform online services. Avoid speaking confidential information while using browser dictation.

## Project layout

```text
public/             Original frontend UI, styles, orb
src/worker.js       Cloudflare Worker routes and safe mock/live switch
src/aem/mock.js     Synthetic AEM fixture generator and scenarios
src/aem/adobe.js    Adobe Cloud Manager read-only OAuth/API adapter
src/aem/sites.js    Optional admin-configured HTTPS site availability checks
test/aem.test.js    Node unit and integration tests
test/e2e/           Playwright desktop/mobile checks (to run in CI)
scripts/preview.js  Offline mock preview with only Node.js
.github/workflows/  GitHub Actions verification for personal mock code
wrangler.jsonc      Cloudflare Workers + Static Assets config
```

## Run locally (no Adobe credentials)

Node 22 or later is recommended.

```bash
npm run preview
# Open http://127.0.0.1:8787
```

This local-only preview needs no packages or credentials and never calls Adobe. It serves the same Worker API shape as the Cloudflare deployment; external weather and GitHub endpoints require network access.

For the actual Workers runtime:

```bash
npm install
npm run check
npm run dev
npm run test:e2e  # installs Playwright browser first; see below
```

For end-to-end testing, run `npx playwright install chromium` (on Linux CI, `npx playwright install --with-deps chromium`). The project GitHub Actions workflow runs these commands automatically after pushing to your own repo.

## Deploy MOCK MODE to your personal Cloudflare account

```bash
npm install
npx wrangler login
npm run deploy
```

The bundled `wrangler.jsonc` explicitly sets:

```json
{"AEM_MODE":"mock","ENABLE_ENTERPRISE_CONNECTORS":"false"}
```

You can preview **synthetic data only** via `/api/aem/overview?scenario=healthy|degraded|incident`. Set the optional Claude secret (`npx wrangler secret put ANTHROPIC_API_KEY`) only after protecting the site with Cloudflare Access and appropriate quotas/rate limiting. No API key is needed for the mock AEM module.

**Do not copy company site URLs, internal logs, private repos, credentials or other sensitive data to your personal GitHub/Cloudflare account.**

## Adobe integration on an approved enterprise environment

Adobe Cloud Manager requires an authorized Adobe Developer Console project with an **OAuth Server-to-Server** technical account, valid product-profile rights and approved API scopes. JWT-based credentials are obsolete.

After a security review, configure an approved company deployment with:

| Environment setting | Use |
|---|---|
| `AEM_MODE=live` | Selects real Cloud Manager adapter |
| `ENABLE_ENTERPRISE_CONNECTORS=true` | Explicit server-side enablement gate |
| `ADOBE_ALLOWED_HOST=...` | Exact approved hostname required for live calls |
| `ADOBE_CLIENT_ID` | Adobe Developer Console client ID |
| `ADOBE_CLIENT_SECRET` | Secret, never committed |
| `ADOBE_ORG_ID` | Approved Adobe IMS organization ID |
| `ADOBE_SCOPES` | Actual scopes supplied by the authorized Adobe integration |
| `AEM_SITE_INVENTORY_JSON` | *Optional secret*: explicitly approved site list with `name`, `url`, `region` keys |

Store sensitive settings in Cloudflare Worker secrets/approved secret management; use `wrangler secret put NAME` for each, not GitHub source files. Live mode should be enabled only behind enterprise identity and policy enforcement in a company-approved Cloudflare account/domain. Confirm egress, residency, audit retention and permitted access with security and legal teams before use.

Example inventory schema **for configuration shape only** (do not copy real enterprise hosts into a personal demo):

```json
[{"name":"Approved Sample","url":"https://example.com","region":"US"}]
```

Currently the live adapter reads a bounded first 10 programs / up to 12 pipelines per program / up to 20 recent executions per pipeline. It is deliberately **not a complete historical reporting engine**. It returns partial-coverage warnings rather than fabricating quarterly metrics. Full-quarter production deployment totals require complete pagination, classification of production deployment steps and cross-checks against Cloud Manager. Rollback counts require an authorized event/audit source; a failed pipeline is not automatically a rollback.

**Cloud Manager alone cannot tell you the full health of 100+ websites.** Authoritative site inventory, HTTP synthetics, CDN metrics, application telemetry, Splunk and Adobe event data should be added and reconciled in an approved company environment. The optional HTTP HEAD probe is a basic availability check, not an end-to-end business or application health verification.

Useful Adobe references:

- [Cloud Manager OAuth](https://developer.adobe.com/experience-cloud/cloud-manager/guides/getting-started/authentication/authentication)
- [Cloud Manager API docs](https://developer.adobe.com/experience-cloud/cloud-manager/reference/)
- [Technical-account permissions](https://developer.adobe.com/experience-cloud/cloud-manager/guides/getting-started/permissions)
- [AEM Log Forwarding / Splunk](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/log-forwarding)

## Security and quality gates before real integration

1. Enterprise Access policy protects all UI/static routes and `/api/*`; no public model endpoint exposed.
2. Read-only Adobe product profiles and reviewed, rotating credentials; no write routes shipped.
3. Strict data provenance: **SIMULATED**, **LIVE**, **PARTIAL**, and **UNKNOWN** never conflated.
4. Ensure no logs, secrets, production URLs or actual enterprise data enter personal accounts or synthetic snapshots.
5. Validate Adobe API schemas and paging against an approved tenant before relying on numbers.
6. Add bounded pagination, persisted history, alert rules, event/audit ingestion, pipeline-to-site mapping and Splunk integration after approval.
7. Run Playwright desktop/mobile e2e in GitHub CI and company-laptop functional testing before enterprise release.
8. AEM actions that modify data must have separate authorization and human approval; none are included here.

## Commands to try

- `Open AEM`
- `How many rollbacks this quarter?` (responds **unknown**, never hallucinates)
- `How many deployments this quarter?` (labels current sample explicitly)
- `Open GitHub`
- `Switch to grid mode`
- `Add note Review sample pipeline failures`

## Current limitations

The Nexora UI now defaults to a cinematic humanoid presence and includes a procedural particle mode. Browser webcam gesture recognition, authentic GitHub OAuth/private repositories, Splunk/AEM application logs, scheduled background AI tasks, long-term multi-device storage, quarterly deployment aggregation, and agentic write actions are not yet implemented. The real Adobe adapter is implemented but **untested against live Adobe**, because no authorized credentials were supplied.

## Humanoid presence prototype

The home screen now opens in **Humanoid** mode by default. The original procedural
particle bust (in `public/humanoid.js`) has pointer-guided head movement and idle,
listening, thinking, and speaking visual states. The `HUMANOID` view button returns
to this mode; the `SPATIAL`, `FOCUS`, and `GRID` options preserve the existing layouts.
The microphone uses browser speech recognition when supported, and spoken assistant
responses can be toggled under Settings. These controls do not provide a licensed
copy of the separate APEX humanoid visual source.

A separate standalone HTML file is provided for offline UI review. It contains the
frontend and synthetic AEM simulator inline; GitHub/weather use browser-accessible
public APIs when connected. It does not include the Cloudflare Worker, the Claude
secret, or a production Adobe connection. The Worker project remains the source
for Cloudflare deployment and enterprise adapter integration testing.


## Presence V2 (November 2026)

The default Humanoid view uses an original offline-friendly, procedural point-cloud portrait with cyan/gold volumetric lighting, face landmarks, breathing, and pointer-driven head movement. The Immersive layout expands the portrait and retains the AEM mock dashboard through its on-screen AEM shortcut. This is an independently authored design, not Reznikov Engineering’s separately licensed APEX humanoid source.


## V4 humanoid / cinematic mode (November 2026)

- **Cinematic mode (default):** original AI-generated blue-and-gold portrait asset (`public/nexora-avatar.webp`), with subtle CSS parallax, floating particles, a breathing effect and state-reactive halos. The portrait is a 2D artwork with animated overlays; it is **not** a fully articulated 3D humanoid and does not lip-sync.
- **3D Particles mode:** independent procedural particle bust renderer (`public/humanoid.js`), WebGL when available and Canvas 2D fallback when unavailable. Eye, nose and mouth geometry, head rotation and state variations are entirely code-generated.
- Select **CINEMATIC** or **3D PARTICLES** in the humanoid view; use IDLE, LISTEN, THINK and SPEAK to preview visual states. LISTEN/SPEAK buttons by themselves are visualization demos, not proof of a microphone/AI integration.
- `Nexora_Spatial_Humanoid_v4.html` is provided separately as an offline standalone demo. The Cloudflare project keeps AEM_MODE=mock by default and preserves the disabled read-only Adobe Cloud Manager connector.
- Artwork is independently generated for this project; no Apex/Reznikov proprietary assets or source were copied. Respect license terms if replacing artwork with licensed third-party media.
- Chromium in the authoring environment had no available WebGL context; browser checks validated the 2D fallback, but GPU rendering needs verification on a machine with WebGL support.

## Personal GitHub → Cloudflare deployment (matching Sitecraft's workflow pattern)

Repository: `ramkarthik77/Nexora`. CI runs Node tests and Playwright on PRs and on `main`;
the separate deploy workflow runs only after **successful CI on main**, or manually.
Sitecraft's deployment demonstrates the same GitHub Actions secret names, but its
container/DB/R2 architecture is **not** copied into this static-assets Worker.

Configure these GitHub Actions repository secrets **separately in Nexora**:

- `CLOUDFLARE_API_TOKEN` — scoped to deploying this Worker in your Cloudflare account.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID, not an API token.

Sitecraft's repository secrets do not transfer automatically across repositories.
Do not place those values in source or copy existing credentials into this repository.
A successful deployment is expected at `https://nexora-spatial.guduriphaniram1988.workers.dev`
assuming this is the same account/subdomain and the Workers subdomain is enabled.
The workflow verifies `/api/health` and a synthetic AEM overview.

Default deployed configuration is `AEM_MODE=mock`, `ENABLE_ENTERPRISE_CONNECTORS=false`.
This public demo must remain entirely synthetic. Live Adobe connections require
an approved corporate hosting environment, identity controls, and separate secrets.

### Claude configuration

The default chat provider is Claude via Anthropic's Messages API. After restricting
access to the application with Cloudflare Access, set `ANTHROPIC_API_KEY` through
`wrangler secret put ANTHROPIC_API_KEY` and, if desired, change `CLAUDE_MODEL`
in `wrangler.jsonc`. Claude API calls run server-side, never in the browser.
Claude **Code** (the local agent CLI) cannot simply run as a subprocess inside a
standard Cloudflare Worker; a separate authorized runner/agent gateway is needed
for repository writes and shell operations. The current app implements Claude AI
chat only, not remote Claude Code execution. Gemini may be selected explicitly
with `AI_PROVIDER=gemini` and `GEMINI_API_KEY` as a Worker secret.

## V6: Natural Voice + Audio-Guided Mouth Movement (mock conversation)

The five scripted questions work **without Claude, Gemini, Adobe, or any API key**. Open the
Humanoid screen → **TEST VOICE CONVERSATION** → select a question. The default
**Device voice · free** mode uses an available English voice through the browser's
Web Speech API. Select an installed voice from the **Voice profile** dropdown.
The canvas now animates mouth shapes using word-boundary cues and speech-state
transitions. Device voices and word-boundary support vary by browser/OS.

For a more human-sounding **optional** voice, the Worker supports ElevenLabs
Text-to-Speech **with timestamps**. This is a **separate audio engine**, not
Claude, so the conversation remains fully mocked. The returned character timings
plus audio amplitude animate approximate mouth shapes; the existing illustration
is still a 2D portrait, not an actual 3D rig. For genuinely photoreal facial
animation, replace the portrait with a licensed/original rigged avatar and
map provider visemes to blend shapes.

### Private studio demo configuration (optional, incurs provider charges)

**Do not enable paid voice generation on a public, unprotected website.** Protect
Nexora with Cloudflare Access and an appropriate WAF/rate-limiting policy before
enabling this endpoint. The voice route requires an additional private token and
accepts only the five known scripted question IDs—never arbitrary client text.
The token prevents anonymous requests but is not a substitute for rate limiting.

Configure these as **Cloudflare Worker secrets**, not GitHub files:

```bash
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put ELEVENLABS_VOICE_ID
npx wrangler secret put VOICE_DEMO_TOKEN
```

Set the non-secret flag `VOICE_DEMO_ENABLED` to `true` in the approved deployment's
Worker environment (while retaining `AEM_MODE=mock` and
`ENABLE_ENTERPRISE_CONNECTORS=false`). Optionally set `ELEVENLABS_MODEL` (default
`eleven_flash_v2_5`). Do **not** enable the flag until access controls are in
place. Then redeploy and verify:

```text
GET /api/demo/voice/status  → configured: true
```

In the UI choose **Studio natural voice**, enter your private demo access token,
then click a scripted question. The secret is not persisted in browser storage.
The Worker contacts ElevenLabs server-side, returns MP3 audio and character
alignment, and the browser animates approximate visemes while playing the audio.
Playback requires a user gesture. If the provider is unavailable, switch back to
**Device voice**.

Security: the API returns `503` when disabled, `401` without the private token,
`400` for an unrecognized question ID, and never forwards arbitrary client text.
No Adobe credentials, company information, or live AEM data are involved.
