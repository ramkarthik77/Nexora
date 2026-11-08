/** Compare fixed-length byte arrays without data-dependent early exit. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

export async function verifyGithubSignature(
  rawBody: string | Uint8Array,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!secret || !header || !/^sha256=[a-f0-9]{64}$/i.test(header)) return false;
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', bytes.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const data = typeof rawBody === 'string' ? bytes.encode(rawBody) : rawBody;
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
  const claimed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) claimed[i] = Number.parseInt(header.slice(7 + i * 2, 9 + i * 2), 16);
  return constantTimeEqual(digest, claimed);
}
