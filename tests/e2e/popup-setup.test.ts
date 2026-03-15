import { test, expect } from './fixtures/extension';

test.describe('SetupScreen E2E (AUTH-003)', () => {
  test.setTimeout(120_000);

  test('first-time user sees setup screen with password creation', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.getByTestId('setup-screen')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByPlaceholder('Create password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.close();
  });

  test('Next button disabled for short passwords', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByTestId('setup-screen')).toBeVisible({
      timeout: 10_000,
    });

    const input = page.getByPlaceholder('Create password');
    await input.click();
    await input.pressSequentially('short', { delay: 30 });
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await input.clear();
    await input.pressSequentially('longpassword', { delay: 30 });
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();

    await page.close();
  });

  test('password mismatch shows error', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByTestId('setup-screen')).toBeVisible({
      timeout: 10_000,
    });

    const createInput = page.getByPlaceholder('Create password');
    await createInput.click();
    await createInput.pressSequentially('mypassword', { delay: 30 });
    await page.getByRole('button', { name: 'Next' }).click();

    const confirmInput = page.getByPlaceholder('Confirm password');
    await expect(confirmInput).toBeVisible();
    await confirmInput.click();
    await confirmInput.pressSequentially('different', { delay: 30 });
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('Passwords do not match')).toBeVisible();

    await page.close();
  });

  test('full setup flow through to vault creation attempt', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByTestId('setup-screen')).toBeVisible({
      timeout: 10_000,
    });

    // Step 1: Create password
    const createInput = page.getByPlaceholder('Create password');
    await createInput.click();
    await createInput.pressSequentially('mypassword', { delay: 30 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Confirm password
    const confirmInput = page.getByPlaceholder('Confirm password');
    await expect(confirmInput).toBeVisible();
    await confirmInput.click();
    await confirmInput.pressSequentially('mypassword', { delay: 30 });
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Step 3: Mnemonic display
    await expect(page.getByTestId('mnemonic-display')).toBeVisible();
    await page
      .getByRole('button', { name: /saved my recovery phrase/i })
      .click();

    // Step 4: Confirm backup → Create Vault
    await expect(
      page.getByRole('button', { name: 'Create Vault' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Create Vault' }).click();

    await expect(page.getByTestId('tree-screen')).toBeVisible({
      timeout: 60_000,
    });

    await page.close();
  });
});
