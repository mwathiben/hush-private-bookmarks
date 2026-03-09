import {
  generateMnemonic as _generateMnemonic,
  validateMnemonic as _validateMnemonic,
  mnemonicToSeedSync,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { encrypt, decrypt } from '@/lib/crypto';
import { InvalidPasswordError, RecoveryError } from '@/lib/errors';
import type { EncryptedStore, Result } from '@/lib/types';

export const RECOVERY_KEY_PREFIX = 'hush_recovery_';

export function generateMnemonic(): string {
  return _generateMnemonic(wordlist, 128);
}

export function validateMnemonic(phrase: string): boolean {
  return _validateMnemonic(phrase, wordlist);
}

export function recoveryStorageKey(setId: string): string {
  return `${RECOVERY_KEY_PREFIX}${setId}`;
}

export async function deriveRecoveryPassword(
  phrase: string,
): Promise<string> {
  const seed = mnemonicToSeedSync(phrase);
  const hex = Array.from(seed, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  for (let i = 0; i < seed.length; i++) seed[i] = 0;
  return hex;
}

export async function createRecoveryBlob(
  plaintext: string,
  phrase: string,
): Promise<EncryptedStore> {
  const password = await deriveRecoveryPassword(phrase);
  return encrypt(plaintext, password);
}

export async function recoverFromBlob(
  blob: EncryptedStore,
  phrase: string,
): Promise<Result<string, RecoveryError | InvalidPasswordError>> {
  const password = await deriveRecoveryPassword(phrase);
  try {
    const data = await decrypt(blob, password);
    return { success: true, data };
  } catch (error) {
    if (error instanceof InvalidPasswordError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new RecoveryError(
        'Recovery blob decryption failed',
        { reason: 'invalid_blob' },
        { cause: error instanceof Error ? error : undefined },
      ),
    };
  }
}
