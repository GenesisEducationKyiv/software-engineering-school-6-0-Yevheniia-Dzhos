import { expect, test } from '@playwright/test';

test.describe('GitHub Release Notifier page', () => {
  test('renders the subscription form and navigation links', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/GitHub Release Notifier/);
    await expect(page.getByRole('heading', { name: 'GitHub Release Notifier' })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Swagger docs' })).toHaveAttribute('href', '/docs');
    await expect(page.getByRole('link', { name: 'Health' })).toHaveAttribute('href', '/health');
  });

  test('submits a valid subscription and shows the success response', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('you@example.com').fill('user@example.com');
    await page.getByPlaceholder('owner/repo').fill('octocat/Hello-World');
    await page.getByRole('button', { name: 'Subscribe' }).click();

    await expect(page.locator('#status')).toHaveText('Subscription successful. Confirmation email sent.');
  });

  test('shows validation errors without leaving the page', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('you@example.com').fill('user@example.com');
    await page.getByPlaceholder('owner/repo').fill('bad');
    await page.getByRole('button', { name: 'Subscribe' }).click();

    await expect(page.locator('#status')).toHaveText('Repository must use owner/repo format.');
  });
});
