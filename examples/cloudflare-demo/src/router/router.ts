import type { AgentId, CanonicalIssueOpened } from '../events/canonical';
import type { RepositoryKind } from './repositories';

/** Deterministic, versionable router. AWS orchestration can call this unchanged. */
export function routeIssue(event: CanonicalIssueOpened, kind: RepositoryKind = 'aem'): AgentId {
  const dev: AgentId = kind === 'aem' ? 'aem-dev-agent' : 'general-dev-agent';
  const assistant: AgentId = kind === 'aem' ? 'aem-assistant' : 'general-assistant';
  const labels = event.issue.labels.map((l) => l.toLowerCase());
  if (labels.some((l) => ['bug', 'defect', 'regression'].includes(l))) return dev;
  if (labels.some((l) => ['question', 'help wanted', 'documentation', 'support'].includes(l))) return assistant;
  const title = event.issue.title.toLowerCase();
  if (/\b(how|what|why|where|can|does|is)\b.*\?|\b(question|explain|guidance|how to)\b/.test(title)) return assistant;
  return dev;
}
