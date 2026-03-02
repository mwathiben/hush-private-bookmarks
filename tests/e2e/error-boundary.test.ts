import { test, expect } from './fixtures/extension';

test.describe('ErrorBoundary', () => {
  test('displays fallback UI when child throws', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(
      `chrome-extension://${extensionId}/popup.html?__test_throw=1`,
    );

    await expect(page.getByText('Something went wrong')).toBeVisible();
    await expect(
      page.getByText('Your bookmarks are safe', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Try Again' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Report Bug' }),
    ).toBeVisible();

    await expect(page.locator('h1')).not.toBeVisible();

    await page.close();
  });

  test('Try Again resets then re-throws (param still set)', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(
      `chrome-extension://${extensionId}/popup.html?__test_throw=1`,
    );

    await expect(page.getByText('Something went wrong')).toBeVisible();

    await page.getByRole('button', { name: 'Try Again' }).click();

    await expect(page.getByText('Something went wrong')).toBeVisible();

    await page.close();
  });

  test('Report Bug opens GitHub issues page', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(
      `chrome-extension://${extensionId}/popup.html?__test_throw=1`,
    );

    await expect(
      page.getByRole('button', { name: 'Report Bug' }),
    ).toBeVisible();

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Report Bug' }).click(),
    ]);

    await newPage.waitForURL(/github\.com.*hush-private-bookmarks/);
    const url = newPage.url();
    expect(url).toContain('github.com');
    expect(url).toContain('hush-private-bookmarks');

    await newPage.close();
    await page.close();
  });
});
