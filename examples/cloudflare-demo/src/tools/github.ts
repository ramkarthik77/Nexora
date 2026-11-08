import type { CanonicalIssueOpened } from '../events/canonical';
import type { RepoFile } from '../agents/types';

const API = 'https://api.github.com';
const MAX_FILE_BYTES = 16_000;
const ALLOWED_EXTENSIONS = /\.(java|xml|html|json|js|ts|css|scss|yaml|yml|cfg|config|txt|md)$/i;
const ALLOWED_MODULES = /^(core|ui\.apps|ui\.config|dispatcher)\//;
const BLOCKED_PATH = /(^|\/)(\.env|\.npmrc|\.git|secrets?|credentials?|private|\.github)(\/|\.|$)|\.(pem|p12|jks|key|keystore|asc)$/i;

export async function githubApi<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: options.method ?? 'GET',
    signal: options.signal,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'nexora-cloudflare-demo',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!response.ok) throw new Error(`GitHub ${options.method ?? 'GET'} failed: HTTP ${response.status} (${path.split('?')[0]})`);
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

interface TreeItem { path: string; type: string; size?: number }
interface GitTree { tree: TreeItem[]; truncated: boolean }
interface GitContent { content?: string; encoding?: string; size: number; type: string }

const STOPWORDS = new Set(['this', 'that', 'from', 'with', 'after', 'shows', 'component', 'issue', 'publish', 'deploy', 'please', 'when', 'does', 'have', 'aem', 'cloud', 'services']);

export function selectRelevantPaths(
  files: TreeItem[],
  issueText: string,
  maxFiles = 5,
): string[] {
  const words = [...new Set((issueText.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) ?? []))]
    .filter((x) => !STOPWORDS.has(x)).slice(0, 30);
  const candidates = files.filter((item) =>
    item.type === 'blob' &&
    ALLOWED_MODULES.test(item.path) &&
    ALLOWED_EXTENSIONS.test(item.path) &&
    !BLOCKED_PATH.test(item.path) &&
    (item.size ?? MAX_FILE_BYTES + 1) <= MAX_FILE_BYTES,
  );
  return candidates.map(({ path }) => {
    const lower = path.toLowerCase();
    const filename = lower.split('/').pop() ?? '';
    let score = 0;
    for (const word of words) {
      if (filename.includes(word)) score += 12;
      else if (lower.includes(word)) score += 5;
    }
    if (/hero|banner/.test(issueText.toLowerCase()) && /hero|banner/.test(lower)) score += 15;
    if (/osgi|service|configuration/.test(issueText.toLowerCase()) && lower.startsWith('ui.config/')) score += 5;
    if (/cache|filter|dispatcher/.test(issueText.toLowerCase()) && lower.startsWith('dispatcher/')) score += 5;
    if (/\.java$/.test(lower)) score += 1;
    return { path, score };
  }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .filter((x) => x.score > 0)
    .slice(0, Math.min(5, maxFiles))
    .map((x) => x.path);
}

/** Repository-scoped, bounded REST retrieval; no shell or broad code-search permission. */
export async function readRelevantRepoFiles(
  event: CanonicalIssueOpened,
  token: string,
  signal?: AbortSignal,
): Promise<RepoFile[]> {
  const repo = `${encodeURIComponent(event.repository.owner)}/${encodeURIComponent(event.repository.name)}`;
  const ref = event.repository.defaultBranch;
  const tree = await githubApi<GitTree>(`/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token, { signal });
  if (tree.truncated) {
    console.warn('GitHub tree truncated; file selection may be incomplete');
  }
  const paths = selectRelevantPaths(tree.tree, `${event.issue.title}\n${event.issue.body}`);
  const results = await Promise.allSettled(paths.map(async (path): Promise<RepoFile> => {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const file = await githubApi<GitContent>(`/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`, token, { signal });
    if (file.type !== 'file' || file.encoding !== 'base64' || !file.content || file.size > MAX_FILE_BYTES) {
      throw new Error(`Unsupported GitHub file response for ${path}`);
    }
    const binary = atob(file.content.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return { path, content: new TextDecoder().decode(bytes).slice(0, MAX_FILE_BYTES) };
  }));
  return results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
}
