import { test, expect } from './fixtures/extension';

test.describe('Extension popup sanity', () => {
  test('popup loads and shows setup screen for first-time user', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(
      page.locator('[data-testid="setup-screen"], [data-testid="login-screen"]'),
    ).toBeVisible({ timeout: 5000 });

    await page.close();
  });

  test('popup has no console errors', async ({ context, extensionId }) => {
    const errors: string[] = [];
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);

    await page.close();
  });
});
