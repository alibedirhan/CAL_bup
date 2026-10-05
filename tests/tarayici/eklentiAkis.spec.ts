import { test, expect } from '@playwright/test';
import { eklentiOrtami, alanlariTanit, yapayKartliCari, POS } from './eklentiYardimci';

// Gerçek sağlayıcıda girişten sonra önce ana sayfa açılabilir. Taklit POS ağdan yalıtılmıştır.
test('girişten sonra ana sayfada “ödeme sayfasına geçin” denir; ödeme sayfasında kart dolar', async () => {
  const e = await eklentiOrtami();
  try {
    await e.c.route(POS + '/login.aspx', async (r) => {
      await r.fulfill({
        contentType: 'text/html; charset=utf-8',
        body:
          r.request().method() === 'POST'
            ? '<script>location.replace("/yapay-ana.aspx")</script>'
            : '<form id="form1" action="./login.aspx" method="post"><input id="lvergino" name="lvergino"><input id="lkullaniciadi" name="lkullaniciadi"><input id="lsifre" name="lsifre" type="password"></form>',
      });
    });
    await e.c.route(POS + '/yapay-ana.aspx', (r) =>
      r.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<h1>Yapay ana sayfa</h1><span>0123456789</span>',
      }),
    );
    await alanlariTanit(e.p);
    await yapayKartliCari(e.p);
    const yeni = e.c.waitForEvent('page');
    await e.p.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true }).click();
    const pos = await yeni;
    await pos.waitForURL(POS + '/yapay-ana.aspx');
    await expect(pos.locator('#cal-bup-pos-yardimcisi')).toContainText('ödeme sayfasına geçin');
    await expect(e.p.getByRole('status').filter({ hasText: 'POS’a giriş yapıldı' })).toBeVisible();
    await pos.goto(POS + '/yapay-odeme.aspx');
    await expect(pos.locator('#kart')).toHaveValue('4242424242424242');
    await expect(pos.locator('#tarih')).toHaveValue('12/35');
    await pos
      .locator('#cal-bup-pos-yardimcisi')
      .getByRole('button', { name: 'Paneli küçült', exact: true })
      .click();
    // Kalıcı depoda yalnız alan seçicileri ve panel tercihi bulunur; kart/cari bilgisi bulunmaz.
    const yerel = await e.c.serviceWorkers()[0]?.evaluate(async () => {
      const ch = (
        globalThis as unknown as { chrome: { storage: { local: { get(k: null): Promise<object> } } } }
      ).chrome;
      return JSON.stringify(await ch.storage.local.get(null));
    });
    expect(Object.keys(JSON.parse(yerel ?? '{}')).sort()).toEqual(['alanlar', 'panel']);
    expect(yerel).not.toMatch(/4242|0123456789/);
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

for (const [uzunluk, yerTutucu, beklenen] of [
  ['4', 'AAYY', '1235'],
  ['7', 'AA/YYYY', '12/2035'],
] as const)
  test(`tek tarih alanı ${yerTutucu} biçiminde tanıtılır ve doldurulur`, async () => {
    const e = await eklentiOrtami();
    try {
      await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
        r.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: `<span id="firma">0123456789</span><label>Kart numarası <input id="kart" maxlength="19"></label><label>Son kullanma <input id="tarih" maxlength="${uzunluk}" placeholder="${yerTutucu}"></label><label>CVV <input id="cvv" maxlength="3"></label>`,
        }),
      );
      await alanlariTanit(e.p);
      await yapayKartliCari(e.p);
      const yeni = e.c.waitForEvent('page');
      await e.p.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true }).click();
      const pos = await yeni;
      await pos.waitForURL(POS + '/yapay-odeme.aspx');
      await expect(pos.locator('#tarih')).toHaveValue(beklenen);
      await expect(pos.locator('#kart')).toHaveValue('4242424242424242');
      await expect(pos.locator('#cvv')).toHaveValue('');
      expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
    } finally {
      await e.kapat();
    }
  });

test('yardımcı paneli küçültme tercihi sayfa yenilenince korunur, yeni bildirim yazısı görünür', async () => {
  const e = await eklentiOrtami();
  try {
    await e.p.goto(POS + '/yapay-odeme.aspx');
    const panel = e.p.locator('#cal-bup-pos-yardimcisi');
    await panel.getByRole('button', { name: 'Paneli küçült', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Numara ve tek tarih alanını tanıt' })).toBeHidden();
    await e.p.reload();
    await expect(panel.getByRole('button', { name: 'Paneli aç', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Numara ve tek tarih alanını tanıt' })).toBeHidden();
    await expect(panel.getByRole('status')).toContainText('bir kez tanıtın');
    await panel.getByRole('button', { name: 'Paneli aç', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Numara ve tek tarih alanını tanıt' })).toBeVisible();
  } finally {
    await e.kapat();
  }
});
