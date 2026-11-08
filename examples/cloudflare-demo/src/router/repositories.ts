/** Portable, explicit repo allowlist. No wildcard access or Cloudflare dependency. */
export type RepositoryKind = 'aem' | 'general';
export interface RepositoryRegistration { fullName: string; kind: RepositoryKind }
/** Syntax: owner/repo[:aem|general],owner/second[:aem|general]. */
export function parseRepositoryAllowlist(value: string): Map<string, RepositoryRegistration> {
  const repos = new Map<string, RepositoryRegistration>();
  for (const entry of value.split(',').map((s) => s.trim()).filter(Boolean)) {
    const match = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?::(aem|general))?$/.exec(entry);
    if (!match) throw new Error(`Invalid repository allowlist entry: ${entry}`);
    const name = match[1].toLowerCase();
    if (repos.has(name)) throw new Error(`Duplicate repository allowlist entry: ${entry}`);
    repos.set(name, { fullName: match[1], kind: (match[2] ?? 'general') as RepositoryKind });
  }
  if (!repos.size) throw new Error('Configure at least one ALLOWED_REPOS entry');
  return repos;
}
export function getAllowedRepository(
  fullName: string, allowlist: Map<string, RepositoryRegistration>
): RepositoryRegistration | undefined {
  return allowlist.get(fullName.toLowerCase());
}
