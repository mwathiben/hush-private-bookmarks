import { describe, it, expect } from 'vitest';
import { generateMnemonic, validateMnemonic } from '@/lib/recovery';

describe('generateMnemonic', () => {
  it('returns 12 words separated by spaces', () => {
    // #given — no preconditions
    // #when
    const phrase = generateMnemonic();
    // #then
    const words = phrase.split(' ');
    expect(words).toHaveLength(12);
  });

  it('returns valid BIP39 mnemonic', () => {
    // #given
    const phrase = generateMnemonic();
    // #when
    const isValid = validateMnemonic(phrase);
    // #then
    expect(isValid).toBe(true);
  });

  it('produces unique phrases across 50 generations', () => {
    // #given
    const phrases = new Set<string>();
    // #when
    for (let i = 0; i < 50; i++) {
      phrases.add(generateMnemonic());
    }
    // #then
    expect(phrases.size).toBe(50);
  });
});

describe('validateMnemonic', () => {
  it('returns true for valid mnemonic', () => {
    // #given
    const phrase = generateMnemonic();
    // #when
    const result = validateMnemonic(phrase);
    // #then
    expect(result).toBe(true);
  });

  it('returns false for random words', () => {
    // #given
    const nonsense = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';
    // #when
    const result = validateMnemonic(nonsense);
    // #then
    expect(result).toBe(false);
  });

  it('returns false for empty string', () => {
    // #given — empty input
    // #when
    const result = validateMnemonic('');
    // #then
    expect(result).toBe(false);
  });

  it('returns false for 11 words (too few)', () => {
    // #given — valid mnemonic with last word removed
    const phrase = generateMnemonic();
    const elevenWords = phrase.split(' ').slice(0, 11).join(' ');
    // #when
    const result = validateMnemonic(elevenWords);
    // #then
    expect(result).toBe(false);
  });

  it('returns false for wrong checksum (swap last word)', () => {
    // #given — valid mnemonic with last word changed
    const phrase = generateMnemonic();
    const words = phrase.split(' ');
    words[11] = words[11] === 'abandon' ? 'ability' : 'abandon';
    const tampered = words.join(' ');
    // #when
    const result = validateMnemonic(tampered);
    // #then
    expect(result).toBe(false);
  });
});
