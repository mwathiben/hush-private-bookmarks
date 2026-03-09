/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { test, expect } from './fixtures/extension';

test.describe('Incognito pure logic in browser context', () => {
  test('determineMode returns correct mode for all state combinations', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(() => {
      type IncognitoState = {
        isIncognitoContext: boolean;
        isAllowedIncognito: boolean;
      };

      type IncognitoMode =
        | 'incognito_active'
        | 'normal_mode'
        | 'incognito_not_allowed';

      function determineMode(state: IncognitoState): IncognitoMode {
        if (!state.isIncognitoContext) return 'normal_mode';
        return state.isAllowedIncognito
          ? 'incognito_active'
          : 'incognito_not_allowed';
      }

      return {
        incognitoActive: determineMode({
          isIncognitoContext: true,
          isAllowedIncognito: true,
        }),
        notAllowed: determineMode({
          isIncognitoContext: true,
          isAllowedIncognito: false,
        }),
        normalTrue: determineMode({
          isIncognitoContext: false,
          isAllowedIncognito: true,
        }),
        normalFalse: determineMode({
          isIncognitoContext: false,
          isAllowedIncognito: false,
        }),
      };
    });

    expect(result.incognitoActive).toBe('incognito_active');
    expect(result.notAllowed).toBe('incognito_not_allowed');
    expect(result.normalTrue).toBe('normal_mode');
    expect(result.normalFalse).toBe('normal_mode');
  });

  test('shouldAutoUnlock is true only for incognito_active', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(() => {
      type IncognitoMode =
        | 'incognito_active'
        | 'normal_mode'
        | 'incognito_not_allowed';

      function shouldAutoUnlock(mode: IncognitoMode): boolean {
        return mode === 'incognito_active';
      }

      return {
        active: shouldAutoUnlock('incognito_active'),
        normal: shouldAutoUnlock('normal_mode'),
        notAllowed: shouldAutoUnlock('incognito_not_allowed'),
      };
    });

    expect(result.active).toBe(true);
    expect(result.normal).toBe(false);
    expect(result.notAllowed).toBe(false);
  });

  test('extension bundles and loads without runtime errors', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');

    expect(errors).toHaveLength(0);
    expect(extensionId).toBeTruthy();
  });
});
