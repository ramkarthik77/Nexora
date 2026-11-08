import type { AgentId, CanonicalIssueOpened } from '../events/canonical';

/** Deterministic, versionable router. AWS orchestration can call this unchanged. */
export function routeIssue(event: CanonicalIssueOpened): AgentId {
  const labels = event.issue.labels.map((l) => l.toLowerCase());
  if (labels.some((l) => ['bug', 'defect', 'regression'].includes(l))) return 'aem-dev-agent';
  if (labels.some((l) => ['question', 'help wanted', 'documentation', 'support'].includes(l))) return 'aem-assistant';
  const title = event.issue.title.toLowerCase();
  if (/\b(how|what|why|where|can|does|is)\b.*\?|\b(question|explain|guidance|how to)\b/.test(title)) return 'aem-assistant';
  return 'aem-dev-agent';
}
