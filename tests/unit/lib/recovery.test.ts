import { describe, it, expect } from 'vitest';
import {
  generateMnemonic,
  validateMnemonic,
  deriveRecoveryPassword,
  createRecoveryBlob,
  recoverFromBlob,
  recoveryStorageKey,
  RECOVERY_KEY_PREFIX,
} from '@/lib/recovery';
import { InvalidPasswordError, RecoveryError } from '@/lib/errors';
import { encrypt } from '@/lib/crypto';

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

  it('returns false for reversed word order (breaks checksum)', () => {
    // #given — valid mnemonic with words reversed
    const phrase = generateMnemonic();
    const reversed = phrase.split(' ').reverse().join(' ');
    // #when
    const result = validateMnemonic(reversed);
    // #then — reversed entropy changes checksum bits
    expect(result).toBe(false);
  });
});

describe('deriveRecoveryPassword', () => {
  it('returns consistent result for same phrase', async () => {
    // #given
    const phrase = generateMnemonic();
    // #when
    const pw1 = await deriveRecoveryPassword(phrase);
    const pw2 = await deriveRecoveryPassword(phrase);
    // #then
    expect(pw1).toBe(pw2);
  });

  it('returns different results for different phrases', async () => {
    // #given
    const phrase1 = generateMnemonic();
    const phrase2 = generateMnemonic();
    // #when
    const pw1 = await deriveRecoveryPassword(phrase1);
    const pw2 = await deriveRecoveryPassword(phrase2);
    // #then
    expect(pw1).not.toBe(pw2);
  });

  it('returns hex string of 128 characters', async () => {
    // #given
    const phrase = generateMnemonic();
    // #when
    const pw = await deriveRecoveryPassword(phrase);
    // #then
    expect(pw).toHaveLength(128);
    expect(pw).toMatch(/^[0-9a-f]+$/);
  });
});

describe('createRecoveryBlob', () => {
  it('produces valid EncryptedStore', async () => {
    // #given
    const phrase = generateMnemonic();
    const plaintext = '{"bookmarks": []}';
    // #when
    const blob = await createRecoveryBlob(plaintext, phrase);
    // #then
    expect(blob).toHaveProperty('salt');
    expect(blob).toHaveProperty('iv');
    expect(blob).toHaveProperty('encrypted');
    expect(blob).toHaveProperty('iterations');
  });
});

describe('recoverFromBlob', () => {
  it('decrypts data encrypted by createRecoveryBlob', async () => {
    // #given
    const phrase = generateMnemonic();
    const plaintext = '{"bookmarks": ["test"]}';
    const blob = await createRecoveryBlob(plaintext, phrase);
    // #when
    const result = await recoverFromBlob(blob, phrase);
    // #then
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(plaintext);
    }
  });

  it('fails with wrong mnemonic phrase', async () => {
    // #given
    const phrase1 = generateMnemonic();
    const phrase2 = generateMnemonic();
    const blob = await createRecoveryBlob('secret data', phrase1);
    // #when
    const result = await recoverFromBlob(blob, phrase2);
    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvalidPasswordError);
    }
  });

  it('fails with invalid blob data', async () => {
    // #given — corrupted blob
    const phrase = generateMnemonic();
    const corruptedBlob = {
      salt: 'not-valid-base64!!!',
      iv: 'also-invalid!!!',
      encrypted: 'garbage-data!!!',
      iterations: 600000,
    };
    // #when
    const result = await recoverFromBlob(corruptedBlob, phrase);
    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(RecoveryError);
      if (result.error instanceof RecoveryError) {
        expect(result.error.context.reason).toBe('invalid_blob');
      }
    }
  });

  it('recovery blob is independent of user password', async () => {
    // #given — encrypt with password A, create recovery with phrase B
    const userPassword = 'my-secret-password';
    const phrase = generateMnemonic();
    const plaintext = '{"data": "important"}';
    await encrypt(plaintext, userPassword);
    const recoveryBlob = await createRecoveryBlob(plaintext, phrase);
    // #when — recover with phrase B (no knowledge of password A)
    const result = await recoverFromBlob(recoveryBlob, phrase);
    // #then
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(plaintext);
    }
  });
});

describe('recoveryStorageKey', () => {
  it('returns hush_recovery_{setId}', () => {
    // #given
    const setId = 'abc-123';
    // #when
    const key = recoveryStorageKey(setId);
    // #then
    expect(key).toBe('hush_recovery_abc-123');
  });
});

describe('RECOVERY_KEY_PREFIX', () => {
  it('is hush_recovery_', () => {
    expect(RECOVERY_KEY_PREFIX).toBe('hush_recovery_');
  });
});
