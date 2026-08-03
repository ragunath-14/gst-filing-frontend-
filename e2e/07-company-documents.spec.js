import { test, expect } from '@playwright/test';
import { TEST_COMPANY, login, apiLoginAdmin, apiGetTestCompanyId, apiDeleteFile } from './helpers.js';

test.describe('Company documents', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_COMPANY);
    await page.getByRole('link', { name: 'My Documents' }).click();
    await expect(page).toHaveURL(/\/documents$/);
  });

  test('page shell renders with search and filters', async ({ page }) => {
    await expect(page.locator('.topbar-title')).toHaveText('My Documents');
    await expect(page.getByPlaceholder('Search documents...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeVisible();
  });

  test('self-uploaded files are filed but excluded from this admin-filed archive view', async ({ page }) => {
    const uniqueName = `pw-self-upload-${Date.now()}.txt`;

    await test.step('upload via the company upload modal', async () => {
      await page.getByRole('button', { name: 'Upload', exact: true }).click();
      await expect(page.getByText('Upload Documents')).toBeVisible();
      await page.locator('.modal input[type="file"]').setInputFiles({
        name: uniqueName,
        mimeType: 'text/plain',
        buffer: Buffer.from('playwright self-upload test content'),
      });
      await page.getByRole('button', { name: /^Upload \(\d+\)/ }).click();
      await expect(page.getByText(/uploaded successfully/)).toBeVisible();
      await page.getByRole('button', { name: 'Done' }).click();
    });

    await test.step('does not appear in My Documents (self-uploads are filtered out of this view)', async () => {
      await page.getByPlaceholder('Search documents...').fill(uniqueName);
      await expect(page.getByText('No documents found')).toBeVisible();
    });

    // Clean up via the admin API since company users cannot delete files themselves.
    const adminToken = await apiLoginAdmin(page.request);
    const companyId = await apiGetTestCompanyId(page.request, adminToken);
    const filesRes = await page.request.get(`/api/admin/files/${companyId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const filesBody = await filesRes.json();
    const uploaded = filesBody.files.find((f) => f.originalName === uniqueName);
    if (uploaded) {
      await apiDeleteFile(page.request, adminToken, uploaded.id || uploaded._id);
    }
  });
});
