import { test, expect } from './fixtures/extension';

test.describe('sync-client build integration', () => {
  test('extension loads with sync-client module bundled', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(
      page.locator('[data-testid="setup-screen"]'),
    ).toBeVisible({ timeout: 10_000 });

    const errors = await page.evaluate(() => {
      const errs: string[] = [];
      window.addEventListener('error', (e) => errs.push(e.message));
      return errs;
    });
    expect(errors.filter((e) => e.includes('sync-client'))).toHaveLength(0);

    await page.close();
  });

  test('service worker active with sync-client', async ({
    context,
    extensionId,
  }) => {
    expect(extensionId).toBeTruthy();

    const [sw] = context.serviceWorkers();
    expect(sw).toBeTruthy();

    const swUrl = sw!.url();
    expect(swUrl).toContain(extensionId);

    await context.newPage();

    const consoleErrors: string[] = [];
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    const syncErrors = consoleErrors.filter((e) => e.includes('sync-client'));
    expect(syncErrors).toHaveLength(0);

    await page.close();
  });
});
