const { test, expect } = require('@playwright/test');

test('homepage loads successfully', async ({ page }) => {
  const response = await page.goto('/');

  expect(response).not.toBeNull();
  expect(response && response.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator('body')).toBeVisible();
});
