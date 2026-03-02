import { test, expect } from './fixtures/extension';

test.describe('Scaffold integration', () => {
  test('popup loads with Tailwind styles applied', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const bgColor = await page.locator('body').evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bgColor).not.toBe('');
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');

    await page.close();
  });

  test('shadcn Button renders with expected styles', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const button = page.getByRole('button', { name: 'Get Started' });
    await expect(button).toBeVisible();

    const display = await button.evaluate(
      (el) => getComputedStyle(el).display,
    );
    expect(['flex', 'inline-flex']).toContain(display);

    await page.close();
  });

  test('background service worker is active', async ({
    context,
    extensionId,
  }) => {
    expect(extensionId).toBeTruthy();
    const workers = context.serviceWorkers();
    expect(workers.length).toBeGreaterThan(0);
  });

  test('popup has no uncaught JavaScript errors', async ({
    context,
    extensionId,
  }) => {
    const errors: string[] = [];
    const page = await context.newPage();
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);

    await page.close();
  });

  test('manifest has correct metadata', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    const response = await page.goto(
      `chrome-extension://${extensionId}/manifest.json`,
    );
    const manifest = await response?.json();

    expect(manifest.name).toBe('Hush Private Bookmarks');
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('bookmarks');

    await page.close();
  });
});
