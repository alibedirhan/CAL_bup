import { test, expect } from '@playwright/test';

const yol = '/CAL_bup/#/sanal-pos';
test('eski v2 kasa tarayıcıda bir kez PIN ile taşınır; yenileyince PIN gerektirmez', async ({ page }) => {
  await page.goto(yol);
  await expect(page.getByRole('button', { name: 'Yeni cari', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const cihaz = '11111111-1111-4111-8111-111111111111';
    const kimlik = '22222222-2222-4222-8222-222222222222';
    const b64 = (b: Uint8Array) => btoa(Array.from(b, (x) => String.fromCharCode(x)).join(''));
    const tuz = new Uint8Array(16).fill(7);
    const iv = new Uint8Array(12).fill(9);
    const hmac = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(32).fill(6),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const imza = await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode('0123'));
    const temel = await crypto.subtle.importKey('raw', imza, 'PBKDF2', false, ['deriveKey']);
    const aes = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: tuz, iterations: 600000 },
      temel,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const acik = {
      surum: 1,
      cariler: [{ id: '33333333-3333-4333-8333-333333333333', ad: 'Eski Yapay Cari', numara: '0123456789' }],
    };
    const ek = new TextEncoder().encode(`cal-bup-pos|2|600000|${b64(tuz)}|${kimlik}|${cihaz}`);
    const kapali = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: ek, tagLength: 128 },
      aes,
      new TextEncoder().encode(JSON.stringify(acik)),
    );
    const z = {
      bicim: 'cal-bup-pos',
      surum: 2,
      cihaz,
      tekrar: 600000,
      tuz: b64(tuz),
      iv: b64(iv),
      kimlik,
      veri: b64(new Uint8Array(kapali)),
    };
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open('bup-rapor', 1);
      q.onsuccess = () => r(q.result);
    });
    await new Promise<void>((r, hata) => {
      const t = db.transaction('kv', 'readwrite');
      const d = t.objectStore('kv');
      d.put(hmac, 'sanal-pos-cihaz-' + cihaz);
      d.put(z, 'sanal-pos-kasa-v1');
      t.oncomplete = () => {
        db.close();
        r();
      };
      t.onerror = () => hata(new Error('Depo yazılamadı'));
    });
  });
  await page.reload();
  await page.getByLabel('Mevcut kasa PIN’i veya parolası').fill('9999');
  await page.getByRole('button', { name: 'Carilerimi taşı', exact: true }).click();
  await expect(page.getByText('Parola yanlış veya şifreli kayıt bozulmuş.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Geçişten önce eski cari yedeğini indir' }).click();
  await page.getByLabel('Mevcut kasa PIN’i veya parolası').fill('0123');
  await page.getByLabel('Taşınabilir yedek parolası', { exact: true }).fill('Yapay yedek parolasi 2035');
  await page
    .getByLabel('Taşınabilir yedek parolası tekrar', { exact: true })
    .fill('Yapay yedek parolasi 2035');
  const indirme = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Yedeği şifrele ve indir', exact: true }).click();
  expect((await indirme).suggestedFilename()).toContain('.calpos');
  await expect(page.getByRole('heading', { name: 'Mevcut carilerinizi yeni profile taşıyın' })).toBeVisible();
  await page.getByLabel('Mevcut kasa PIN’i veya parolası').fill('0123');
  await page.getByRole('button', { name: 'Carilerimi taşı', exact: true }).click();
  await page.locator('.pos-cari').filter({ hasText: 'Eski Yapay Cari' }).click();
  await expect(page.getByRole('button', { name: 'Kart ekle', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Mevcut kasa PIN’i veya parolası')).toHaveCount(0);
  await page.locator('.pos-cari').filter({ hasText: 'Eski Yapay Cari' }).click();
  await expect(page.getByRole('heading', { name: 'Eski Yapay Cari', exact: true })).toBeVisible();
});

test('engellenmiş depo boş listeye dönüşmez; yeniden deneme aynı veriyi korur', async ({ page }) => {
  await page.addInitScript(() => {
    const gercek = indexedDB.open.bind(indexedDB);
    const durum = window as Window & { posDepoEngelli?: boolean };
    durum.posDepoEngelli = true;
    indexedDB.open = (...args: Parameters<IDBFactory['open']>) => {
      if (durum.posDepoEngelli) {
        throw new Error('Yapay engelli depo');
      }
      return gercek(...args);
    };
  });
  await page.goto(yol);
  await expect(page.getByText('Cari ve kart deposu okunamadı.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yeni cari', exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    (window as Window & { posDepoEngelli?: boolean }).posDepoEngelli = false;
  });
  await page.getByRole('button', { name: 'Profil durumunu yeniden kontrol et', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yeni cari', exact: true })).toBeVisible();
});
