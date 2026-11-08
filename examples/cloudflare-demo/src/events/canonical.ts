/** Stable core contract: no Cloudflare or GitHub SDK dependencies. */
export type AgentId = 'aem-dev-agent' | 'aem-assistant';

export interface CanonicalIssueOpened {
  schemaVersion: '1.0';
  eventId: string;
  eventType: 'engineering.issue.opened';
  receivedAt: string;
  source: { system: 'github'; deliveryId: string };
  repository: { owner: string; name: string; fullName: string; defaultBranch: string };
  issue: {
    id: number;
    number: number;
    title: string;
    body: string;
    url: string;
    labels: string[];
  };
  trustLevel: 'untrusted';
}
