import { test, expect } from '@playwright/test';
import { TEST_ADMIN, TEST_COMPANY, login, fieldByLabel } from './helpers.js';

test.describe('Admin companies list (read-only)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_ADMIN);
    await page.getByRole('link', { name: 'Companies' }).click();
    await expect(page).toHaveURL(/\/admin\/companies$/);
  });

  test('lists the test company with expected columns', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Company' })).toBeVisible();
    const row = page.locator('tr', { hasText: TEST_COMPANY.companyName });
    await expect(row).toBeVisible();
    await expect(row.getByText(TEST_COMPANY.gstin)).toBeVisible();
  });

  test('search narrows the list and clears back to full list', async ({ page }) => {
    const search = page.getByPlaceholder('Search companies...');
    await search.fill('no-such-company-xyz');
    await expect(page.getByText('No companies found')).toBeVisible();
    await expect(page.getByText('Try a different search')).toBeVisible();

    await search.fill(TEST_COMPANY.companyName);
    await expect(page.locator('tr', { hasText: TEST_COMPANY.companyName })).toBeVisible();
  });

  test('clicking a row navigates to company detail', async ({ page }) => {
    await page.locator('tr', { hasText: TEST_COMPANY.companyName }).click();
    await expect(page).toHaveURL(/\/admin\/companies\/[a-f0-9]+$/);
    await expect(page.locator('.topbar-title')).toHaveText(TEST_COMPANY.companyName);
  });
});

test.describe('Admin companies CRUD', () => {
  // Uses a uniquely-named/GSTIN'd company created and destroyed within this
  // test so it never collides with (or leaves residue alongside) the fixed
  // Playwright Test Co used by other specs, or any real company data.
  const suffix = Date.now().toString().slice(-8);
  const newCompanyName = `PW CRUD Co ${suffix}`;
  const newGstin = `29PWCRUD${suffix}Z1`;
  const editedCompanyName = `${newCompanyName} Edited`;

  test.beforeEach(async ({ page }) => {
    await login(page, TEST_ADMIN);
    await page.getByRole('link', { name: 'Companies' }).click();
    await expect(page).toHaveURL(/\/admin\/companies$/);
  });

  test('create, edit, and delete a company', async ({ page }) => {
    await test.step('create', async () => {
      await page.getByRole('button', { name: 'Add Company' }).click();
      await expect(page.getByText('Add New Company')).toBeVisible();

      await page.getByPlaceholder('Acme Pvt Ltd').fill(newCompanyName);
      await page.getByPlaceholder('22AAAAA0000A1Z5').fill(newGstin);
      await page.getByPlaceholder('user@company.com').fill(TEST_COMPANY.email.replace('pwtest-company', `pwtest-crud-${suffix}`));
      await page.getByPlaceholder('Min 6 characters').fill('CrudTest123');

      await page.getByRole('button', { name: 'Create Company' }).click();
      await expect(page.getByText('✅ Company Created!')).toBeVisible();
      await page.getByRole('button', { name: 'Got it, Close' }).click();
    });

    await test.step('appears in list', async () => {
      const search = page.getByPlaceholder('Search companies...');
      await search.fill(newCompanyName);
      await expect(page.locator('tr', { hasText: newCompanyName })).toBeVisible();
    });

    await test.step('edit', async () => {
      const row = page.locator('tr', { hasText: newCompanyName });
      await row.getByTitle('Edit company').click();
      await expect(page.locator('.modal-title')).toHaveText('Edit Company');
      const modal = page.locator('.modal');
      await fieldByLabel(modal, 'Company Name *').fill(editedCompanyName);
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect(page.getByText('Company updated!')).toBeVisible();
      await expect(page.locator('tr', { hasText: editedCompanyName })).toBeVisible();
    });

    await test.step('delete', async () => {
      page.once('dialog', (dialog) => dialog.accept());
      const row = page.locator('tr', { hasText: editedCompanyName });
      await row.getByTitle('Delete company').click();
      await expect(page.getByText('Company deleted')).toBeVisible();
      await expect(page.locator('tr', { hasText: editedCompanyName })).toHaveCount(0);
    });
  });
});
