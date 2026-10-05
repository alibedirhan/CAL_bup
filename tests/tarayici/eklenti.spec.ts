import { test, expect } from '@playwright/test';
import { eklentiOrtami, alanlariTanit, yapayKartliCari, kartliPosAc, POS } from './eklentiYardimci';
for (const ayri of [false, true])
  test(
    'gerçek MV3 eklentisi: cari eşleşmesi, ' + (ayri ? 'ay/yıl' : 'tek tarih') + ' ve sıfır ödeme/SMS',
    async () => {
      const e = await eklentiOrtami({ ayri });
      try {
        const kur = await e.c.newPage();
        await alanlariTanit(kur, ayri);
        await kur.close();
        await yapayKartliCari(e.p);
        const pos = await kartliPosAc(e.p, e.c);
        await expect(pos.locator('#kart')).toHaveValue('4242424242424242');
        if (ayri) {
          await expect(pos.locator('#ay')).toHaveValue('12');
          await expect(pos.locator('#yil')).toHaveValue('35');
        } else await expect(pos.locator('#tarih')).toHaveValue('12/35');
        await expect(e.p.getByRole('status').filter({ hasText: 'Cari eşleşti; numara' })).toBeVisible();
        await expect(pos.locator('#cvv')).toHaveValue('');
        await expect(pos.locator('#tutar')).toHaveValue('777');
        expect(await pos.evaluate(() => Reflect.get(window, 'yapayOlay'))).toBe(0);
        expect(e.sayac).toEqual({ giris: 1, sms: 0, odeme: 0, dis: 0 });
        const w = e.c.serviceWorkers()[0];
        expect(w).toBeTruthy();
        const gizli = await w?.evaluate(async () => {
          const ch = (
            globalThis as unknown as {
              chrome: {
                storage: {
                  local: { get: (k: string) => Promise<unknown> };
                  session: { get: (k: string) => Promise<unknown> };
                };
              };
            }
          ).chrome;
          return JSON.stringify([
            await ch.storage.local.get('alanlar'),
            await ch.storage.session.get('isler'),
          ]).includes('4242424242424242');
        });
        expect(gizli).toBe(false);
      } finally {
        await e.kapat();
      }
    },
  );
test('yanlış cari numarası kart aktarımını tamamen durdurur', async () => {
  const e = await eklentiOrtami({ yanlis: true });
  try {
    const kur = await e.c.newPage();
    await alanlariTanit(kur);
    await kur.close();
    await yapayKartliCari(e.p);
    const pos = await kartliPosAc(e.p, e.c);
    await expect(e.p.locator('#pos-aktarim-hatasi')).toContainText('eşleşmiyor');
    await expect(pos.locator('#kart')).toHaveValue('');
    await expect(pos.locator('#tarih')).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
test('CVV, tutar ve ödeme düğmesi alan tanıtımında seçilemez; tıklama işlem başlatmaz', async () => {
  const e = await eklentiOrtami();
  try {
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await e.p.getByRole('button', { name: 'Numara ve tek tarih alanını tanıt', exact: true }).click();
    await e.p.locator('#firma').click();
    for (const sec of ['#cvv', '#tutar', 'button[type="submit"]']) {
      await e.p.locator(sec).click();
      await expect(e.p.locator('#cal-bup-pos-yardimcisi')).toContainText(
        /Bu alan uygun değil|Önce boş kart\/tarih/,
      );
    }
    await e.p.getByRole('button', { name: 'Şifre gönder', exact: true }).click();
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
test('tanıtılmamış ekran ve iptal sonrası kart kuyrukta kalmaz', async () => {
  const e = await eklentiOrtami();
  try {
    await yapayKartliCari(e.p);
    const pos = await kartliPosAc(e.p, e.c);
    await expect(pos.locator('#cal-bup-pos-yardimcisi')).toContainText('bir kez tanıtın');
    await e.p.getByRole('button', { name: 'Aktarımı durdur', exact: true }).click();
    await alanlariTanit(pos);
    await expect(pos.locator('#kart')).toHaveValue('');
    const w = e.c.serviceWorkers()[0];
    await expect
      .poll(async () =>
        w?.evaluate(async () => {
          const ch = (
            globalThis as unknown as {
              chrome: { storage: { session: { get: (k: string) => Promise<unknown> } } };
            }
          ).chrome;
          return JSON.stringify(await ch.storage.session.get('isler')).includes('4242424242424242');
        }),
      )
      .toBe(false);
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
test('başka kart bilgisi bulunan alan ezilmez; yanlış web sayfasından köprü erişimi yoktur', async () => {
  const e = await eklentiOrtami();
  try {
    const kur = await e.c.newPage();
    await alanlariTanit(kur);
    await kur.close();
    await yapayKartliCari(e.p);
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<span id="firma">0123456789</span><label>Kart numarası<input id="kart" value="5555555555554444" maxlength="23"></label><label>Son kullanma<input id="tarih" maxlength="5"></label>',
      }),
    );
    const pos = await kartliPosAc(e.p, e.c);
    await expect(e.p.locator('#pos-aktarim-hatasi')).toContainText('doldurulamadı');
    await expect(pos.locator('#kart')).toHaveValue('5555555555554444');
    await expect(pos.locator('#tarih')).toHaveValue('');
    const dis = await e.c.newPage();
    await e.c.route('https://alibedirhan.github.io/baska/', (r) =>
      r.fulfill({
        body: '<html><body>Yapay başka site</body></html>',
        contentType: 'text/html; charset=utf-8',
      }),
    );
    await dis.goto('https://alibedirhan.github.io/baska/');
    expect(
      await dis.evaluate(async () => {
        let yanit = false;
        window.addEventListener('message', (e) => {
          if (e.data?.kanal === 'CAL_BUP_POS_YANIT_1') yanit = true;
        });
        window.postMessage({ kanal: 'CAL_BUP_POS_1', id: crypto.randomUUID(), is: 'durum' }, location.origin);
        await new Promise((r) => setTimeout(r, 200));
        return yanit;
      }),
    ).toBe(false);
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
test('eklenti yokken işlem başlamaz ve kurulum hatası görünür', async ({ page }) => {
  await page.goto('/CAL_bup/#/sanal-pos');
  // Yerel adres eklentinin dar izin kapsamının dışındadır.
  const { cariHazirla, kartDoldur } = await import('./yardimci');
  await cariHazirla(page);
  await kartDoldur(page);
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await page.locator('.pos-odeme-karti').click();
  await page.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true }).click();
  await expect(page.locator('#pos-aktarim-hatasi')).toContainText('yayımlanmış CAL bup adresinde');
  expect(page.context().pages()).toHaveLength(1);
});

test('kart değişikliği ve rota çıkışı eski kartın sonradan doldurulmasını önler', async () => {
  for (const rota of [false, true]) {
    const e = await eklentiOrtami();
    try {
      await yapayKartliCari(e.p);
      if (!rota) {
        const { kartDoldur } = await import('./yardimci');
        await kartDoldur(e.p, 'İkinci Yapay Kart');
        await e.p.getByLabel('Kart numarası', { exact: true }).fill('5555555555554444');
        await e.p.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
        await e.p.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
        await e.p.locator('.pos-odeme-karti').filter({ hasText: 'Yapay Eklenti Kartı' }).click();
      }
      const pos = await kartliPosAc(e.p, e.c);
      await expect(pos.locator('#cal-bup-pos-yardimcisi')).toContainText('bir kez tanıtın');
      if (rota) await e.p.getByRole('link', { name: 'Ayarlar', exact: true }).click();
      else await e.p.locator('.pos-odeme-karti').filter({ hasText: 'İkinci Yapay Kart' }).click();
      const w = e.c.serviceWorkers()[0];
      await expect
        .poll(() =>
          w?.evaluate(async () => {
            const ch = (
              globalThis as unknown as {
                chrome: { storage: { session: { get(k: string): Promise<unknown> } } };
              }
            ).chrome;
            return JSON.stringify(await ch.storage.session.get('isler')).includes('4242424242424242');
          }),
        )
        .toBe(false);
      await alanlariTanit(pos);
      await expect(pos.locator('#kart')).toHaveValue('');
      expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
    } finally {
      await e.kapat();
    }
  }
});

test('POS sekmesi kapanınca aktarım iptali kullanıcıya görünür', async () => {
  const e = await eklentiOrtami();
  try {
    await yapayKartliCari(e.p);
    const pos = await kartliPosAc(e.p, e.c);
    await pos.close();
    await expect(e.p.locator('#pos-aktarim-hatasi')).toContainText('Sekme kapandı');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('tanıtılan tarih alanı sonradan CVV olursa hiçbir alan doldurulmaz', async () => {
  const e = await eklentiOrtami();
  try {
    const kur = await e.c.newPage();
    await alanlariTanit(kur);
    await kur.close();
    await yapayKartliCari(e.p);
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<span id="firma">0123456789</span><label>Kart numarası<input id="kart" maxlength="23"></label><label>CVV<input id="tarih" maxlength="3"></label>',
      }),
    );
    const pos = await kartliPosAc(e.p, e.c);
    await expect(e.p.locator('#pos-aktarim-hatasi')).toContainText('doldurulamadı');
    await expect(pos.locator('#kart')).toHaveValue('');
    await expect(pos.locator('#tarih')).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('POS sekmesine geçişte profil bilgileri gizlenirken izin verilen aktarım tamamlanır', async () => {
  const e = await eklentiOrtami();
  try {
    await yapayKartliCari(e.p);
    const pos = await kartliPosAc(e.p, e.c);
    await e.p.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await alanlariTanit(pos);
    await expect(pos.locator('#kart')).toHaveValue('4242424242424242');
    await expect(pos.locator('#tarih')).toHaveValue('12/35');
    await expect(pos.locator('#cvv')).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('süresi dolmuş geçici kart kuyruktan silinir ve sonraki kurulumda doldurulmaz', async () => {
  const e = await eklentiOrtami();
  try {
    await yapayKartliCari(e.p);
    const pos = await kartliPosAc(e.p, e.c);
    const w = e.c.serviceWorkers()[0];
    expect(w).toBeTruthy();
    await w?.evaluate(() => {
      const eski = Date.now;
      Date.now = () => eski() + 190_000;
    });
    await expect
      .poll(() =>
        w?.evaluate(async () => {
          const ch = (
            globalThis as unknown as {
              chrome: { storage: { session: { get(k: string): Promise<unknown> } } };
            }
          ).chrome;
          return JSON.stringify(await ch.storage.session.get('isler')).includes('4242424242424242');
        }),
      )
      .toBe(false);
    await expect(e.p.locator('#pos-aktarim-hatasi')).toContainText('süresi doldu');
    await alanlariTanit(pos);
    await expect(pos.locator('#kart')).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('cari alanı kaybolunca kart gönderilmez ve hata uygulamada da görünür', async () => {
  const e = await eklentiOrtami();
  try {
    const kur = await e.c.newPage();
    await alanlariTanit(kur);
    await kur.close();
    await yapayKartliCari(e.p);
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<label>Kart numarası<input id="kart" maxlength="23"></label><label>Son kullanma<input id="tarih" maxlength="5"></label>',
      }),
    );
    const pos = await kartliPosAc(e.p, e.c);
    await expect(e.p.locator('#pos-aktarim-hatasi')).toContainText('cari alanı okunamadı');
    await expect(pos.locator('#kart')).toHaveValue('');
    await expect(pos.locator('#tarih')).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
