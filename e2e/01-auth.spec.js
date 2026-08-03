import { test, expect } from '@playwright/test';
import { TEST_ADMIN, TEST_COMPANY, login, logout } from './helpers.js';

test.describe('Authentication', () => {
  test('shows an error on invalid credentials', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/auth/login')),
      login(page, { email: TEST_ADMIN.email, password: 'wrong-password' }),
    ]);
    expect(response.status()).toBe(401);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('requires both fields to be filled', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Please fill all fields')).toBeVisible();
  });

  test('admin can log in and see the admin dashboard', async ({ page }) => {
    await login(page, TEST_ADMIN);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('.topbar-subtitle')).toHaveText(`Welcome back, ${TEST_ADMIN.name}`);
    await expect(page.getByRole('link', { name: 'Companies' })).toBeVisible();
  });

  test('admin can log out', async ({ page }) => {
    await login(page, TEST_ADMIN);
    await expect(page).toHaveURL(/\/admin$/);
    await logout(page);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('company user can log in and see the company dashboard', async ({ page }) => {
    await login(page, TEST_COMPANY);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(`Welcome, ${TEST_COMPANY.name}`)).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Documents' })).toBeVisible();
  });

  test('unauthenticated user is redirected away from protected routes', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('company user cannot access admin routes', async ({ page }) => {
    await login(page, TEST_COMPANY);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/admin/companies');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
