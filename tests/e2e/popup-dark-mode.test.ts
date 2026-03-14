import { test, expect } from './fixtures/extension';

test.describe('Dark mode system preference (AUTH-004)', () => {
  test('applies dark class when system prefers dark', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(
      page.locator('[data-testid="setup-screen"], [data-testid="login-screen"]'),
    ).toBeVisible({ timeout: 10_000 });

    const hasDarkClass = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(hasDarkClass).toBe(true);

    await page.close();
  });

  test('does not apply dark class when system prefers light', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(
      page.locator('[data-testid="setup-screen"], [data-testid="login-screen"]'),
    ).toBeVisible({ timeout: 10_000 });

    const hasDarkClass = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(hasDarkClass).toBe(false);

    await page.close();
  });
});
