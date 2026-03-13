import { test, expect } from './fixtures/extension';

test.describe('Popup auth routing (AUTH-001)', () => {
  test('first-time user sees setup screen', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.getByTestId('setup-screen')).toBeVisible({ timeout: 5000 });

    await page.close();
  });

  test('popup resolves from loading to a screen', async ({
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
});
