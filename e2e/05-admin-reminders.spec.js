import { test, expect } from '@playwright/test';
import { TEST_ADMIN, TEST_COMPANY, login } from './helpers.js';

test.describe('Admin all-reminders page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_ADMIN);
    await page.getByRole('link', { name: 'All Reminders' }).click();
    await expect(page).toHaveURL(/\/admin\/reminders$/);
  });

  test('page shell and filters render', async ({ page }) => {
    await expect(page.locator('.topbar-title')).toHaveText('All Reminders');
    await expect(page.getByPlaceholder('Search reminders...')).toBeVisible();
    await expect(page.getByRole('button', { name: /^All Returns/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^All\s*\d+/ })).toBeVisible();
  });

  test('full add/search/delete lifecycle for a reminder', async ({ page }) => {
    const title = `Playwright global reminder ${Date.now()}`;

    await test.step('create via modal', async () => {
      await page.locator('.topbar-actions').getByRole('button', { name: 'Add Reminder' }).click();
      await expect(page.locator('.modal-title')).toHaveText('Add Reminder');
      await page.locator('.modal select').first().selectOption({ label: TEST_COMPANY.companyName });
      await page.getByPlaceholder('GSTR-3B April 2025 Filing').fill(title);
      await page.locator('.modal input[type="date"]').fill('2026-12-31');
      await page.locator('.modal').getByRole('button', { name: 'Add Reminder' }).click();
      await expect(page.getByText('Reminder added!')).toBeVisible();
    });

    await test.step('findable via search', async () => {
      await page.getByPlaceholder('Search reminders...').fill(title);
      await expect(page.getByText(title)).toBeVisible();
    });

    await test.step('delete', async () => {
      page.once('dialog', (dialog) => dialog.accept());
      const row = page.locator('.reminder-item', { hasText: title });
      await row.locator('.reminder-actions button').last().click();
      await expect(page.getByText('Deleted')).toBeVisible();
      await expect(page.getByText(title)).toHaveCount(0);
    });
  });
});
