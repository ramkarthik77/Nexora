import type { Analysis } from '../agents/types';
import type { AgentId, CanonicalIssueOpened } from '../events/canonical';
import { githubApi } from '../tools/github';

const LABEL = 'nexora-analyzed';
const escapeMarkdown = (s: string) => s.replace(/[<>]/g, (ch) => ch === '<' ? '&lt;' : '&gt;');

export function formatAnalysisComment(
  event: CanonicalIssueOpened,
  agent: AgentId,
  analysis: Analysis,
  filePaths: string[],
): string {
  const lines = [
    `<!-- nexora-delivery:${event.source.deliveryId} -->`,
    `## 🤖 Nexora analysis`,
    '',
    `**Agent:** \`${agent}\`  ·  **Confidence:** ${analysis.confidence}  ·  **Likely module:** \`${analysis.affectedModule}\``,
    '',
    `### Summary`, escapeMarkdown(analysis.summary), '',
    `### Likely root cause`, escapeMarkdown(analysis.likelyRootCause), '',
    `### Suggested fix`, escapeMarkdown(analysis.suggestedFix), '',
    `### Context reviewed`,
    filePaths.length ? filePaths.map((p) => `- \`${p.replace(/`/g, '')}\``).join('\n') : '- No matching repository files found',
    '- **Mocked AEM error log only** (not evidence from your environment)',
    '',
  ];
  if (analysis.questions.length) lines.push('### Questions / missing context', ...analysis.questions.map((q) => `- ${escapeMarkdown(q)}`), '');
  lines.push('> Demo only: AI-generated hypothesis. No code changes, merge, deploy, or live Splunk queries were performed.');
  return lines.join('\n');
}

interface ExistingComment { body?: string; user?: { login: string } }

/** The only module permitted to write to GitHub. */
export async function publishGithubAnalysis(
  event: CanonicalIssueOpened,
  agent: AgentId,
  analysis: Analysis,
  files: string[],
  token: string,
  signal?: AbortSignal,
): Promise<void> {
  const { owner, name } = event.repository;
  const prefix = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const issuePath = `${prefix}/issues/${event.issue.number}`;
  const marker = `<!-- nexora-delivery:${event.source.deliveryId} -->`;
  // This check helps on retries if a comment succeeded but a later API call failed.
  const comments = await githubApi<ExistingComment[]>(`${issuePath}/comments?per_page=100`, token, { signal });
  if (!comments.some((c) => c.body?.includes(marker))) {
    await githubApi(`${issuePath}/comments`, token, {
      method: 'POST', body: { body: formatAnalysisComment(event, agent, analysis, files) }, signal,
    });
  }
  // Idempotent set operation; label must already exist on the repository.
  await githubApi(`${issuePath}/labels`, token, {
    method: 'POST', body: { labels: [LABEL] }, signal,
  });
}
