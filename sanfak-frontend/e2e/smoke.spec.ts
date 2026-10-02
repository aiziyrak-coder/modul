import { test, expect } from '@playwright/test';

test('root sahifa yuklanadi va asosiy app shell (sidebar) ko‘rinadi', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-sidebar')).toBeVisible();
});

test.skip('OneID/PIN orqali real autentifikatsiya oqimi — keyingi bosqich', async () => {});
