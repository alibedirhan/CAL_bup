import { test, expect } from '@playwright/test';

test('taklit kuralı yokken dış ağ kapalı, yerel uygulama açıktır', async ({ page, context }) => {
  await page.goto('/CAL_bup/');
  await expect(page.getByRole('link', { name: 'Sanal POS', exact: true })).toBeVisible();
  const dis = await context.newPage();
  // Ayrılmış .invalid alanı; müşteri/sağlayıcı veya ödeme adresi kullanılmaz.
  await expect(dis.goto('https://cal-bup-ag-denemesi.invalid/')).rejects.toThrow(/PROXY_CONNECTION_FAILED/);
});
