import { test, expect } from '@playwright/test';
import { TEST_ADMIN, TEST_COMPANY, login } from './helpers.js';

const companyOptionLabel = `${TEST_COMPANY.companyName} (${TEST_COMPANY.gstin})`;

test.describe('Admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_ADMIN);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('shows stat cards and key actions', async ({ page }) => {
    await expect(page.getByText('Total Companies')).toBeVisible();
    await expect(page.getByText('Overdue Filings')).toBeVisible();
    await expect(page.getByText('GSTR-1 Pending')).toBeVisible();
    await expect(page.getByText('GSTR-3B Pending')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Smart Upload' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manual Upload' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Company' })).toBeVisible();
  });

  test('company filing status card links to companies list', async ({ page }) => {
    await expect(page.getByText('Company Filing Status')).toBeVisible();
    await page.getByText('Company Filing Status').locator('..').getByRole('button', { name: 'View All' }).click();
    await expect(page).toHaveURL(/\/admin\/companies$/);
  });

  test('upcoming deadlines card links to reminders list', async ({ page }) => {
    const card = page.locator('.card', { hasText: 'Upcoming Deadlines' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'View All' }).click();
    await expect(page).toHaveURL(/\/admin\/reminders$/);
  });

  test('manual upload modal opens with the test company selectable', async ({ page }) => {
    await page.getByRole('button', { name: 'Manual Upload' }).click();
    await expect(page.getByText('Upload GST Document')).toBeVisible();
    const companySelect = page.locator('.modal select').first();
    await companySelect.selectOption({ label: companyOptionLabel });
    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.getByText('Upload GST Document')).not.toBeVisible();
  });
});
