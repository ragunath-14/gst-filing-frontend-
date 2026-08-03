import { test, expect } from '@playwright/test';
import {
  TEST_COMPANY,
  login,
  apiLoginAdmin,
  apiGetTestCompanyId,
  apiCreateReminder,
  apiDeleteReminder,
} from './helpers.js';

test.describe('Company reminders (read-only view)', () => {
  let adminToken;
  let companyId;
  let reminder;
  const title = `Playwright company-view reminder ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    adminToken = await apiLoginAdmin(page.request);
    companyId = await apiGetTestCompanyId(page.request, adminToken);
    reminder = await apiCreateReminder(page.request, adminToken, companyId, {
      title,
      filingType: 'GSTR-1',
      priority: 'high',
    });

    await login(page, TEST_COMPANY);
    await page.getByRole('link', { name: 'My Reminders' }).click();
    await expect(page).toHaveURL(/\/reminders$/);
  });

  test.afterEach(async ({ page }) => {
    if (reminder) {
      await apiDeleteReminder(page.request, adminToken, reminder.id || reminder._id);
    }
  });

  test('page shell shows stat cards and filters', async ({ page }) => {
    await expect(page.locator('.topbar-title')).toHaveText('My Reminders');
    await expect(page.locator('.stat-card', { hasText: 'Total' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Pending' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Overdue' })).toBeVisible();
    await expect(page.locator('.stat-card', { hasText: 'Completed' })).toBeVisible();
  });

  test('a reminder created by the admin is visible with its details', async ({ page }) => {
    const row = page.locator('.reminder-item', { hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText('GSTR-1')).toBeVisible();
    await expect(row.getByText('Priority: high')).toBeVisible();
  });

  test('no create/edit controls are exposed to the company user', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add Reminder' })).toHaveCount(0);
  });
});
