import { z } from 'zod';
import type { CanonicalIssueOpened } from '../events/canonical';

const issueSchema = z.object({
  action: z.literal('opened'),
  issue: z.object({
    id: z.number().int().positive(),
    number: z.number().int().positive(),
    title: z.string().max(1000),
    body: z.string().nullable().optional(),
    html_url: z.string().url(),
    labels: z.array(z.object({ name: z.string() })).default([]),
    pull_request: z.unknown().optional(),
  }),
  repository: z.object({
    name: z.string(),
    full_name: z.string(),
    default_branch: z.string(),
    owner: z.object({ login: z.string() }),
  }),
});

export function normalizeGithubIssueOpened(
  payload: unknown,
  deliveryId: string,
  receivedAt = new Date().toISOString(),
): CanonicalIssueOpened {
  const parsed = issueSchema.parse(payload);
  if (parsed.issue.pull_request !== undefined) throw new Error('PR is not an issue for this demo');
  if (parsed.repository.full_name !== `${parsed.repository.owner.login}/${parsed.repository.name}`) {
    throw new Error('Repository identity mismatch');
  }
  return {
    schemaVersion: '1.0',
    eventId: `github:${deliveryId}`,
    eventType: 'engineering.issue.opened',
    receivedAt,
    source: { system: 'github', deliveryId },
    repository: {
      owner: parsed.repository.owner.login,
      name: parsed.repository.name,
      fullName: parsed.repository.full_name,
      defaultBranch: parsed.repository.default_branch,
    },
    issue: {
      id: parsed.issue.id,
      number: parsed.issue.number,
      title: parsed.issue.title,
      body: (parsed.issue.body ?? '').slice(0, 20_000),
      url: parsed.issue.html_url,
      labels: parsed.issue.labels.map((l) => l.name),
    },
    trustLevel: 'untrusted',
  };
}
