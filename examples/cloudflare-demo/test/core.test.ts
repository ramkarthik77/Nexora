import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyGithubSignature, constantTimeEqual } from '../src/ingest/verify';
import { normalizeGithubIssueOpened } from '../src/ingest/normalize';
import { routeIssue } from '../src/router/router';
import { selectRelevantPaths } from '../src/tools/github';
import { analysisSchema } from '../src/agents/types';
import { formatAnalysisComment } from '../src/publisher/github';

const raw = {
  action: 'opened',
  issue: { id: 42, number: 5, title: 'Hero component shows blank on publish', body: 'Sling model broken', html_url: 'https://github.com/a/b/issues/5', labels: [{ name: 'bug' }] },
  repository: { owner: { login: 'a' }, name: 'b', full_name: 'a/b', default_branch: 'main' },
};
const event = normalizeGithubIssueOpened(raw, '123e4567-e89b-42d3-a456-426614174000');

test('validates signed raw payload and rejects tampering', async () => {
  const body = JSON.stringify(raw);
  const sig = `sha256=${createHmac('sha256', 'testsecret').update(body).digest('hex')}`;
  assert.equal(await verifyGithubSignature(body, sig, 'testsecret'), true);
  assert.equal(await verifyGithubSignature(body + ' ', sig, 'testsecret'), false);
  assert.equal(await verifyGithubSignature(body, 'sha256=broken', 'testsecret'), false);
  assert.equal(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true);
  assert.equal(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3])), false);
});

test('normalizes GitHub issue without carrying source-specific fields', () => {
  assert.equal(event.eventType, 'engineering.issue.opened');
  assert.equal(event.repository.fullName, 'a/b');
  assert.deepEqual(event.issue.labels, ['bug']);
  assert.equal(event.trustLevel, 'untrusted');
  assert.throws(() => normalizeGithubIssueOpened({ ...raw, action: 'edited' }, '123'), /Invalid/);
});

test('router prioritizes bug label; routes questions; defaults to dev', () => {
  assert.equal(routeIssue(event), 'aem-dev-agent');
  assert.equal(routeIssue({ ...event, issue: { ...event.issue, title: 'How do I deploy this?', labels: [] } }), 'aem-assistant');
  assert.equal(routeIssue({ ...event, issue: { ...event.issue, title: 'Component render issue', labels: [] } }), 'aem-dev-agent');
});

test('file selector stays in authorized AEM modules and chooses hero files', () => {
  const paths = selectRelevantPaths([
    { path: 'core/src/main/java/com/acme/HeroModel.java', type: 'blob', size: 1200 },
    { path: 'ui.apps/src/main/content/jcr_root/apps/site/components/hero/hero.html', type: 'blob', size: 400 },
    { path: '.github/workflows/deploy.yml', type: 'blob', size: 900 },
    { path: 'core/src/main/resources/secret.pem', type: 'blob', size: 100 },
  ], event.issue.title);
  assert.equal(paths.length, 2);
  assert.ok(paths.some((p) => p.includes('HeroModel')));
});

test('schema validates Claude JSON, publisher marks mocked context', () => {
  const analysis = analysisSchema.parse({
    summary: 'Hero blank on publish', likelyRootCause: 'Missing Sling Model injection',
    affectedModule: 'core', suggestedFix: 'Check the model', confidence: 'medium', questions: [],
  });
  const comment = formatAnalysisComment(event, 'aem-dev-agent', analysis, []);
  assert.match(comment, /Mocked AEM error log only/);
  assert.match(comment, /nexora-delivery/);
  assert.throws(() => analysisSchema.parse({ ...analysis, affectedModule: 'some-module' }));
});
