import { test, expect } from '@playwright/test';
import { TEST_ADMIN, TEST_COMPANY, login } from './helpers.js';

test.describe('Admin company detail', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_ADMIN);
    await page.getByRole('link', { name: 'Companies' }).click();
    await page.locator('tr', { hasText: TEST_COMPANY.companyName }).click();
    await expect(page.locator('.topbar-title')).toHaveText(TEST_COMPANY.companyName);
  });

  test('shows company info and all three tabs', async ({ page }) => {
    await expect(page.locator('.topbar-subtitle')).toContainText(TEST_COMPANY.gstin);
    await expect(page.getByRole('button', { name: /Files \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Company Uploads \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reminders \(\d+\)/ })).toBeVisible();
  });

  test('back link returns to companies list', async ({ page }) => {
    await page.getByRole('button', { name: 'Back to Companies' }).click();
    await expect(page).toHaveURL(/\/admin\/companies$/);
  });

  test('upload a file, see it under Files, then delete it', async ({ page }) => {
    const uniqueName = `pw-test-upload-${Date.now()}.pdf`;

    await test.step('upload', async () => {
      await page.locator('.topbar-actions').getByRole('button', { name: 'Upload File' }).click();
      await expect(page.getByText('Upload GST File')).toBeVisible();
      await page.locator('#fileInput').setInputFiles({
        name: uniqueName,
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 playwright test file'),
      });
      await page.getByRole('button', { name: 'Upload', exact: true }).click();
      // A prior run this month/year may have used the same default filing
      // period+type, in which case the backend flags this as a possible
      // duplicate (still a successful upload, just a softer toast).
      await expect(page.getByText(/File uploaded!|looks like a duplicate/)).toBeVisible();
    });

    await test.step('appears in Files tab', async () => {
      await expect(page.getByText(uniqueName)).toBeVisible();
    });

    await test.step('delete it', async () => {
      page.once('dialog', (dialog) => dialog.accept());
      const fileRow = page.locator('.file-item', { hasText: uniqueName });
      await fileRow.locator('.file-actions .btn-danger').click();
      await expect(page.getByText(uniqueName)).toHaveCount(0);
    });
  });

  test('add a reminder, mark it complete, then delete it', async ({ page }) => {
    const title = `Playwright reminder ${Date.now()}`;

    await page.getByRole('button', { name: /Reminders \(\d+\)/ }).click();

    await test.step('create', async () => {
      await page.locator('.topbar-actions').getByRole('button', { name: 'Add Reminder' }).click();
      await expect(page.getByText('Add Filing Reminder')).toBeVisible();
      await page.getByPlaceholder('GSTR-3B Filing for April 2025').fill(title);
      await page.locator('.modal input[type="date"]').fill('2026-12-31');
      await page.locator('.modal').getByRole('button', { name: 'Add Reminder' }).click();
      await expect(page.getByText('Reminder created!')).toBeVisible();
    });

    await test.step('appears in list', async () => {
      await expect(page.getByText(title)).toBeVisible();
    });

    await test.step('mark complete', async () => {
      const row = page.locator('.reminder-item', { hasText: title });
      await row.getByTitle('Mark complete').click();
      await expect(page.getByText('Marked as completed')).toBeVisible();
    });

    await test.step('delete', async () => {
      page.once('dialog', (dialog) => dialog.accept());
      const row = page.locator('.reminder-item', { hasText: title });
      await row.locator('.reminder-actions button').last().click();
      await expect(page.getByText(title)).toHaveCount(0);
    });
  });
});
