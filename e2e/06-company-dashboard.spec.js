import { test, expect } from '@playwright/test';
import { TEST_COMPANY, login } from './helpers.js';

test.describe('Company dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_COMPANY);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('shows profile card and stats for the logged-in company', async ({ page }) => {
    await expect(page.locator('.topbar-subtitle')).toHaveText(`Welcome, ${TEST_COMPANY.name}`);
    await expect(page.getByText(TEST_COMPANY.companyName)).toBeVisible();
    await expect(page.getByText(`GSTIN: ${TEST_COMPANY.gstin}`)).toBeVisible();

    await expect(page.getByText('Total Documents')).toBeVisible();
    await expect(page.getByText('Pending Filings')).toBeVisible();
    await expect(page.getByText('Overdue Filings')).toBeVisible();
    await expect(page.getByText('Completed')).toBeVisible();
  });

  test('view all buttons navigate to documents and reminders', async ({ page }) => {
    const viewAllButtons = page.getByRole('button', { name: 'View All' });
    await viewAllButtons.first().click();
    await expect(page).toHaveURL(/\/documents$/);

    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'View All' }).last().click();
    await expect(page).toHaveURL(/\/reminders$/);
  });

  test('sidebar nav exposes company routes only', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Documents' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Reminders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Companies' })).toHaveCount(0);
  });
});
