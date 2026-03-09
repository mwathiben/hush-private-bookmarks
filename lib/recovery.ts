import {
  generateMnemonic as _generateMnemonic,
  validateMnemonic as _validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export function generateMnemonic(): string {
  return _generateMnemonic(wordlist, 128);
}

export function validateMnemonic(phrase: string): boolean {
  return _validateMnemonic(phrase, wordlist);
}
