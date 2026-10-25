// Audit-log hash chain (SHA-256 via the browser's Web Crypto API).
// hash = SHA-256 hex of  prevHash | at | actor | action | fdrId  (joined with '|', fdrId '' when null).
// The first entry's prevHash is GENESIS_HASH. Same formula as the backend (docs/api-contract.md).

export const GENESIS_HASH = '0'.repeat(64);

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function entryHash(prevHash, { at, actor, action, fdrId }) {
  return sha256Hex([prevHash, at, actor, action, fdrId ?? ''].join('|'));
}

// Recompute every hash from the genesis entry, oldest first.
// Returns { valid, entries, brokenAt } — brokenAt is the id of the first entry that doesn't match.
// Once one entry is off, every later recomputed hash differs too, so the chain is broken from there on.
export async function verifyChain(oldestFirst) {
  let expectedPrev = GENESIS_HASH;
  for (const e of oldestFirst) {
    const expected = await entryHash(expectedPrev, e);
    if (e.prevHash !== expectedPrev || e.hash !== expected) return { valid: false, entries: oldestFirst.length, brokenAt: e.id };
    expectedPrev = expected;
  }
  return { valid: true, entries: oldestFirst.length, brokenAt: null };
}
