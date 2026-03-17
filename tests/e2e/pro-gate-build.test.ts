import { test, expect } from './fixtures/extension';

test.describe('Pro-gate build integration', () => {
  test('extension loads without errors after extpay dependency added', async ({
    context,
    extensionId,
  }) => {
    const errors: string[] = [];
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
    await page.close();
  });

  test('service worker is active with extpay in bundle', async ({
    context,
  }) => {
    let workers = context.serviceWorkers();
    if (workers.length === 0) {
      await context.waitForEvent('serviceworker', { timeout: 10_000 });
    }
    workers = context.serviceWorkers();
    expect(workers.length).toBeGreaterThan(0);
  });

});
