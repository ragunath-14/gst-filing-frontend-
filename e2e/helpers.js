export const TEST_ADMIN = {
  email: 'codersgang85+pwtest-admin@gmail.com',
  password: 'PwTest#Admin123',
  name: 'Playwright Admin',
};

export const TEST_COMPANY = {
  email: 'codersgang85+pwtest-company@gmail.com',
  password: 'PwTest#Company123',
  name: 'Playwright Company User',
  companyName: 'Playwright Test Co',
  gstin: '29PWTST0001A1Z9',
};

export async function login(page, { email, password }) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

// Inputs in this app's edit-mode modals often drop their `placeholder` once
// they have a value, so the most reliable way to target a field is by its
// sibling <label> text within the nearest `.form-group`.
export function fieldByLabel(scope, labelText) {
  return scope.locator('.form-group', { hasText: labelText }).locator('input, select, textarea').first();
}

export async function logout(page) {
  await page.getByTitle('Click to logout').click();
  await page.waitForURL('**/login');
}

// --- API-level helpers for isolated test-data setup/teardown ---
// These call the backend directly so each spec file can create the fixtures
// it needs and clean them up itself, without depending on other spec files
// or touching any pre-existing real data.

export async function apiLoginAdmin(request) {
  const res = await request.post('/api/auth/login', {
    data: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
  });
  const body = await res.json();
  return body.token;
}

export async function apiGetTestCompanyId(request, adminToken) {
  const res = await request.get('/api/admin/companies', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await res.json();
  const company = body.companies.find((c) => c.gstin === TEST_COMPANY.gstin);
  if (!company) throw new Error('Playwright test company not found — run backend/create_playwright_test_users.py');
  return company.id || company._id;
}

export async function apiCreateReminder(request, adminToken, companyId, overrides = {}) {
  // dueDate must be a bare YYYY-MM-DD (matching what the <input type="date">
  // form actually sends) rather than a full ISO timestamp: the backend
  // compares it against a naive datetime.utcnow() and throws a 500 if it's
  // timezone-aware (e.g. a "...Z"-suffixed ISO string).
  const fiveDaysOut = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const res = await request.post('/api/admin/reminders', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      companyId,
      title: 'Playwright test reminder',
      filingType: 'GSTR-3B',
      dueDate: fiveDaysOut,
      filingPeriod: 'Playwright FY',
      priority: 'medium',
      ...overrides,
    },
  });
  const body = await res.json();
  return body.reminder;
}

export async function apiDeleteReminder(request, adminToken, reminderId) {
  await request.delete(`/api/admin/reminders/${reminderId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function apiDeleteFile(request, adminToken, fileId) {
  await request.delete(`/api/admin/files/${fileId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}
