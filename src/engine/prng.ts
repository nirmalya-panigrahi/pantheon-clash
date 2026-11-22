/**
 * Normalizes any numeric input into a valid non-zero unsigned 32-bit seed.
 */
export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    return 1;
  }
  const normalized = Math.trunc(seed) >>> 0;
  return normalized === 0 ? 1 : normalized;
}

/**
 * Deterministic 32-bit Mulberry32 PRNG returning floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let state = normalizeSeed(seed);
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a deterministic sub-seed from the match seed, round index, and salt.
 */
export function deriveSeed(matchSeed: number, round: number, salt = 0): number {
  const base = normalizeSeed(matchSeed);
  const r = Math.trunc(round) >>> 0;
  const s = Math.trunc(salt) >>> 0;
  let mixed = (base ^ Math.imul(r + 1, 0x9e3779b9) ^ Math.imul(s + 7, 0x85ebca6b)) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b) >>> 0;
  return normalizeSeed(mixed);
}

/**
 * Returns a new deterministically shuffled copy of `items` using Mulberry32.
 */
export function shuffleDeterministic<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  const rng = mulberry32(seed);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Parses user-entered text or numeric seed into a deterministic 32-bit seed.
 */
export function parseSeedInput(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    return 202601;
  }
  if (/^-?\d+$/.test(trimmed)) {
    return normalizeSeed(Number(trimmed));
  }
  let hash = 2166136261;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return normalizeSeed(hash);
}
