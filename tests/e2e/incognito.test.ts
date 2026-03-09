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
