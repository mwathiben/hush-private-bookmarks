/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, verifyPassword } from '@/lib/crypto';
import { InvalidPasswordError } from '@/lib/errors';

describe('edge cases', () => {
  it('encrypts and decrypts empty string', async () => {
    const store = await encrypt('', 'test-password-123');
    const result = await decrypt(store, 'test-password-123');
    expect(result).toBe('');
  });

  it('encrypts and decrypts single character', async () => {
    const store = await encrypt('a', 'test-password-123');
    const result = await decrypt(store, 'test-password-123');
    expect(result).toBe('a');
  });

  it(
    'encrypts and decrypts 1MB input without truncation',
    async () => {
      const chunk = 'A'.repeat(1024);
      const oneMB = chunk.repeat(1024);

      const store = await encrypt(oneMB, 'test-password-123');
      const result = await decrypt(store, 'test-password-123');

      expect(result.length).toBe(oneMB.length);
      expect(result).toBe(oneMB);
    },
    120_000,
  );

  it('encrypts and decrypts Unicode characters', async () => {
    const unicode = [
      '\u{1F512}',
      '\u79C1\u306E\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF',
      '\u0645\u0631\u062C\u0639\u200C\u0647\u0627',
      '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}',
      '\u{1F30D}',
    ].join(' ');

    const store = await encrypt(unicode, 'test-password-123');
    const result = await decrypt(store, 'test-password-123');

    expect(result).toBe(unicode);
  });

  it('encrypts and decrypts string with null bytes', async () => {
    const withNulls = 'hello\x00world\x00end';

    const store = await encrypt(withNulls, 'test-password-123');
    const result = await decrypt(store, 'test-password-123');

    expect(result).toBe(withNulls);
    expect(result).toContain('\x00');
  });

  it('encrypts and decrypts JSON special characters', async () => {
    const json =
      '{"key": "value with \\"quotes\\"", "path": "C:\\\\Users\\\\test", "nl": "line1\\nline2"}';

    const store = await encrypt(json, 'test-password-123');
    const result = await decrypt(store, 'test-password-123');

    expect(result).toBe(json);
  });

  it('encrypt rejects empty password', async () => {
    await expect(encrypt('test data', '')).rejects.toThrow(
      'Password cannot be empty',
    );
  });

  it('decrypt rejects empty password', async () => {
    const store = await encrypt('test data', 'valid-password');
    await expect(decrypt(store, '')).rejects.toThrow(
      'Password cannot be empty',
    );
  });

  it('verifyPassword re-throws empty password error', async () => {
    const store = await encrypt('test data', 'valid-password');

    const error = await verifyPassword(store, '').catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Password cannot be empty');
    expect(error).not.toBeInstanceOf(InvalidPasswordError);
  });
});
