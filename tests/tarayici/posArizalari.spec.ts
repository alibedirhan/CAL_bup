import { readFileSync } from 'node:fs';
const SURUM: string = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).version;
import { test, expect, type Worker, type BrowserContext } from '@playwright/test';
import { eklentiOrtami, yapayKartliCari, kartliPosAc, APP, POS } from './eklentiYardimci';
function arkaPlan(c: BrowserContext): Worker {
  const w = c.serviceWorkers()[0];
  if (!w) throw new Error('Yapay testte yardımcı arka planı açılmadı.');
  return w;
}
// Değerlendirme işlevleri tarayıcıya serialize edilir: yardımcıyı closure olarak kullanma.
async function kuyruktaPan(w: Worker) {
  return w.evaluate(async () => {
    const ch = (
      globalThis as unknown as { chrome: { storage: { session: { get(k: string): Promise<unknown> } } } }
    ).chrome;
    return JSON.stringify(await ch.storage.session.get('isler')).includes('4242424242424242');
  });
}
test('bağlantı kontrolü kart göndermez, POS açmaz ve yardımcı sürümünü bildirir', async () => {
  const e = await eklentiOrtami();
  try {
    await yapayKartliCari(e.p);
    await e.p.getByRole('button', { name: 'Yardımcı bağlantısını kontrol et', exact: true }).click();
    await expect(
      e.p.getByRole('status').filter({ hasText: `POS yardımcısı bağlı (${SURUM})` }),
    ).toBeVisible();
    expect(e.c.pages()).toHaveLength(2); // başlangıç boş sekmesi ve uygulama
    expect(await kuyruktaPan(arkaPlan(e.c))).toBe(false);
    expect(e.sayac).toEqual({ giris: 0, sms: 0, odeme: 0, dis: 0 });
  } finally {
    await e.kapat();
  }
});
for (const geri of [false, true])
  test(
    geri
      ? 'saat geri alınırsa geçici PAN silinir ve aktarım sonlanır'
      : 'teslim alındı bildirimi gelmezse belirsiz sonuç gösterilir, PAN yeniden gönderilmez',
    async () => {
      const e = await eklentiOrtami();
      try {
        await yapayKartliCari(e.p);
        const pos = await kartliPosAc(e.p, e.c);
        await expect(pos.locator('#cal-bup-pos-yardimcisi')).toContainText('bir kez tanıtın');
        const w = arkaPlan(e.c);
        if (geri)
          await w.evaluate(() => {
            const eski = Date.now;
            Date.now = () => eski() - 60_000;
          });
        else
          await w.evaluate(async () => {
            const ch = (
              globalThis as unknown as {
                chrome: {
                  storage: {
                    session: {
                      get(k: string): Promise<{ isler: Array<Record<string, unknown>> }>;
                      set(d: unknown): Promise<void>;
                    };
                  };
                };
              }
            ).chrome;
            const d = await ch.storage.session.get('isler');
            for (const i of d.isler) {
              delete i.kart;
              i.durum = 'teslim';
              i.teslimSon = Date.now() - 1;
            }
            await ch.storage.session.set(d);
          });
        await expect(e.p.locator('#pos-aktarim-hatasi')).toContainText(
          geri ? 'süresi doldu' : 'sonucu doğrulanamadı',
        );
        expect(await kuyruktaPan(w)).toBe(false);
        await expect(pos.locator('#kart')).toHaveValue('');
        expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
      } finally {
        await e.kapat();
      }
    },
  );
for (const tekrar of [false, true])
  test(
    tekrar
      ? 'POS giriş sonucu tekrar giriş ekranıysa açık hata ve tek giriş denemesi'
      : 'giriş alanları değişmişse kart silinir ve hata uygulamaya ulaşır',
    async () => {
      const e = await eklentiOrtami();
      try {
        let post = 0;
        await e.c.route(POS + '/login.aspx', async (r) => {
          if (r.request().method() === 'POST') post++;
          await r.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: tekrar
              ? '<form id="form1" method="post" action="./login.aspx"><input id="lvergino"><input id="lkullaniciadi"><input id="lsifre" type="password"><span id="lblgizleme">Yapay hata 0123456789</span></form>'
              : '<h1>Değişmiş yapay giriş sayfası</h1>',
          });
        });
        await yapayKartliCari(e.p);
        await e.p.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true }).click();
        await expect(e.p.locator('#pos-aktarim-hatasi')).toContainText(
          tekrar ? 'POS girişi kabul edilmedi: “Yapay hata •••”' : 'giriş sayfası',
        );
        // Sağlayıcı yazısındaki uzun rakam dizileri programa taşınmaz.
        await expect(e.p.locator('#pos-aktarim-hatasi')).not.toContainText('0123456789');
        expect(post).toBe(tekrar ? 1 : 0);
        expect(await kuyruktaPan(arkaPlan(e.c))).toBe(false);
        expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
      } finally {
        await e.kapat();
      }
    },
  );
test('iki uygulama sekmesi aynı anda POS aktarımı başlatamaz', async () => {
  const e = await eklentiOrtami();
  try {
    await yapayKartliCari(e.p);
    await kartliPosAc(e.p, e.c);
    const p2 = await e.c.newPage();
    await p2.goto(APP + '#/sanal-pos');
    await p2.locator('.pos-cari').click();
    await p2.locator('.pos-odeme-karti').click();
    const once = e.c.pages().length;
    await p2.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true }).click();
    await expect(p2.locator('#pos-aktarim-hatasi')).toContainText('Başka program sekmesinde');
    expect(e.c.pages()).toHaveLength(once);
    expect(e.sayac.giris).toBe(1);
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
// Bu dosyada gerçek müşteri verisi veya sağlayıcı ağı kullanılmaz.
test('alan seçimi silinemediğinde hata görünür, işlenmemiş söz reddi oluşmaz', async () => {
  const e = await eklentiOrtami();
  try {
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await expect(e.p.locator('#cal-bup-pos-yardimcisi')).toBeVisible();
    const hatalar: string[] = [];
    e.p.on('pageerror', (err) => hatalar.push(err.message));
    await arkaPlan(e.c).evaluate(() => {
      const ch = (
        globalThis as unknown as { chrome: { storage: { local: { set(d: unknown): Promise<void> } } } }
      ).chrome;
      ch.storage.local.set = async () => {
        throw new Error('Yapay depo arızası');
      };
    });
    await e.p.getByRole('button', { name: 'Bu sayfanın kurulumunu sil', exact: true }).click();
    await expect(e.p.locator('#cal-bup-pos-yardimcisi')).toContainText('Alan seçimi silinemedi');
    expect(hatalar).toEqual([]);
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
test('önceki alan kaydının geç yanıtı yeni seçim talimatını değiştirmez', async () => {
  const e = await eklentiOrtami();
  try {
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await expect(e.p.locator('#cal-bup-pos-yardimcisi')).toBeVisible();
    await arkaPlan(e.c).evaluate(() => {
      const ch = (
        globalThis as unknown as { chrome: { storage: { local: { set(d: unknown): Promise<void> } } } }
      ).chrome;
      const eski = ch.storage.local.set.bind(ch.storage.local);
      ch.storage.local.set = async (d) => {
        await new Promise((r) => setTimeout(r, 2000));
        await eski(d);
      };
    });
    const b = e.p.getByRole('button', { name: 'Numara ve tek tarih alanını tanıt', exact: true });
    await b.click();
    await e.p.locator('#firma').click();
    await e.p.locator('#kart').click();
    await e.p.locator('#tarih').click();
    await b.click();
    await expect(e.p.locator('#cal-bup-pos-yardimcisi')).toContainText('1/3:');
    await e.p.waitForTimeout(2500);
    await expect(e.p.locator('#cal-bup-pos-yardimcisi')).toContainText('1/3:');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
