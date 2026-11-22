import { describe, expect, it } from 'vitest';
import {
  deriveSeed,
  mulberry32,
  normalizeSeed,
  parseSeedInput,
  shuffleDeterministic,
} from '../prng';

describe('Mulberry32 PRNG utilities', () => {
  it('Blue Pill: produces identical sequences for identical seeds', () => {
    const rngA = mulberry32(202601);
    const rngB = mulberry32(202601);
    const seqA = Array.from({ length: 10 }, () => rngA());
    const seqB = Array.from({ length: 10 }, () => rngB());

    expect(seqA).toEqual(seqB);
    seqA.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  it('Blue Pill: shuffleDeterministic returns a deterministic permutation without mutating input', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const snapshot = [...source];
    const shuffled1 = shuffleDeterministic(source, 99123);
    const shuffled2 = shuffleDeterministic(source, 99123);
    const shuffledOther = shuffleDeterministic(source, 99124);

    expect(source).toEqual(snapshot);
    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).not.toEqual(shuffledOther);
    expect([...shuffled1].sort((a, b) => a - b)).toEqual(source);
  });

  it('Blue Pill: parseSeedInput parses numeric and phrase seeds deterministically', () => {
    expect(parseSeedInput('202601')).toBe(202601);
    expect(parseSeedInput('olympus')).toBe(parseSeedInput('olympus'));
    expect(parseSeedInput('olympus')).not.toBe(parseSeedInput('asgard'));
  });

  it('Red Pill: normalizeSeed and deriveSeed safely sanitize zero, negative, and non-finite inputs', () => {
    expect(normalizeSeed(0)).toBe(1);
    expect(normalizeSeed(-42)).toBeGreaterThan(0);
    expect(normalizeSeed(Number.NaN)).toBe(1);
    expect(normalizeSeed(Number.POSITIVE_INFINITY)).toBe(1);
    expect(parseSeedInput('   ')).toBe(202601);
    expect(deriveSeed(0, -1, Number.NaN)).toBeGreaterThan(0);
  });
});
