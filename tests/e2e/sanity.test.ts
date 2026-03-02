import { test, expect } from './fixtures/extension';

test.describe('Extension popup sanity', () => {
  test('popup loads and displays expected content', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator('h1')).toHaveText('Hush');
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();

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
