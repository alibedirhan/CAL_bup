import { test, expect } from '@playwright/test';
import { posKilidiniAc } from './yardimci';

const yol = '/CAL_bup/#/sanal-pos';
test('eski v2 kasa bir kez PIN ile taşınır, ardından Sanal POS parolası belirlenir', async ({ page }) => {
  await page.goto(yol);
  await expect(page.getByRole('heading', { name: 'Sanal POS parolası belirleyin' })).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Geçişten önce eski cari yedeğini indir' })).toHaveCount(0);
  await page.getByLabel('Mevcut kasa PIN’i veya parolası').fill('0123');
  await page.getByRole('button', { name: 'Carilerimi taşı', exact: true }).click();
  await expect(page.getByText('Kayıtlı cari ve kartlarınız bundan sonra yalnız bu parolayla')).toBeVisible();
  await posKilidiniAc(page);
  await page.locator('.pos-cari').filter({ hasText: 'Eski Yapay Cari' }).click();
  await expect(page.getByRole('button', { name: 'Kart ekle', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Mevcut kasa PIN’i veya parolası')).toHaveCount(0);
  await posKilidiniAc(page);
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
  await posKilidiniAc(page);
  await expect(page.getByRole('button', { name: 'Yeni cari', exact: true })).toBeVisible();
});

test('1.17’nin parolasız kaydı (kayıtlı CVV dahil) parola belirlenince korunur; eski anahtar silinir', async ({
  page,
}) => {
  await page.goto(yol);
  await expect(page.getByRole('heading', { name: 'Sanal POS parolası belirleyin' })).toBeVisible();
  // 1.17'nin yazdığı biçimde yapay kayıt: anahtar aynı tarayıcıda, zarf `kip: 'cihaz'`.
  await page.evaluate(async () => {
    const b64 = (b: Uint8Array) => btoa(Array.from(b, (x) => String.fromCharCode(x)).join(''));
    const kimlik = '44444444-4444-4444-8444-444444444444';
    const revizyon = '55555555-5555-4555-8555-555555555555';
    const cari = {
      id: '66666666-6666-4666-8666-666666666666',
      ad: 'Parolasız Yapay Cari',
      numara: '0123456789',
    };
    const kart = {
      id: '77777777-7777-4777-8777-777777777777',
      cariId: cari.id,
      ad: 'Yapay eski kart',
      numara: '4242424242424242',
      sahibi: '',
      ay: '12',
      yil: '2035',
      telefon: '',
      onayTarihi: '2026-10-08T00:00:00.000Z',
      cvv: '321',
    };
    const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    const iv = b64(crypto.getRandomValues(new Uint8Array(12)));
    const ek = new TextEncoder().encode(`cal-bup-pos-profil|1|cihaz|${kimlik}|${revizyon}|${iv}||0`);
    const kapali = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: Uint8Array.from(atob(iv), (c) => c.charCodeAt(0)),
        additionalData: ek,
        tagLength: 128,
      },
      k,
      new TextEncoder().encode(JSON.stringify({ surum: 2, cariler: [cari], kartlar: [kart] })),
    );
    const z = {
      bicim: 'cal-bup-pos-profil',
      surum: 1,
      kip: 'cihaz',
      kimlik,
      revizyon,
      iv,
      veri: b64(new Uint8Array(kapali)),
      tuz: '',
      tekrar: 0,
    };
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open('bup-rapor', 1);
      q.onsuccess = () => r(q.result);
    });
    await new Promise<void>((r, hata) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(k, 'sanal-pos-profil-anahtar-' + kimlik);
      t.objectStore('kv').put(z, 'sanal-pos-kasa-v1');
      t.oncomplete = () => {
        db.close();
        r();
      };
      t.onerror = () => hata(new Error('Depo yazılamadı'));
    });
  });
  await page.reload();
  await expect(page.getByText('Kayıtlı cari ve kartlarınız bundan sonra yalnız bu parolayla')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Parolasız Yapay Cari');
  await posKilidiniAc(page);
  await page.locator('.pos-cari').filter({ hasText: 'Parolasız Yapay Cari' }).click();
  await expect(page.locator('.pos-odeme-karti')).toContainText('CVV •••');
  const anahtarlar = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open('bup-rapor', 1);
      q.onsuccess = () => r(q.result);
    });
    const a = await new Promise<string[]>((r) => {
      const q = db.transaction('kv').objectStore('kv').getAllKeys();
      q.onsuccess = () => r(q.result.map(String));
    });
    db.close();
    return a;
  });
  expect(anahtarlar.filter((a) => a.startsWith('sanal-pos-profil-anahtar-'))).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sanal POS kilitli' })).toBeVisible();
});
