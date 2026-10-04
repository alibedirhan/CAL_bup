import { test, expect } from '@playwright/test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ISKONTO_KATEGORILERI, type IskontoUrunu } from '../../src/cekirdek/iskonto/turler';

test('İskonto: özgün işçi 24.000 üründe kuruşları korur ve ana ekran çalışır', async ({ page }) => {
  const dosyalar = (await readdir('dist/assets')).filter((ad) => /^worker-.*\.js$/.test(ad));
  let isciDosyasi: string | undefined;
  for (const ad of dosyalar) {
    if ((await readFile(join('dist/assets', ad), 'utf8')).includes('Fiyat listesi işlemi tamamlanamadı'))
      isciDosyasi = ad;
  }
  if (!isciDosyasi) throw new Error('Derlenmiş iskonto işçisi bulunamadı.');
  await page.goto('/CAL_bup/#/satis/iskonto');
  const olcum = await page.evaluate(
    async ({ dosya, adlar }) => {
      const kategori = adlar[0] ?? '';
      const kategoriler = Object.fromEntries<IskontoUrunu[]>(adlar.map((ad) => [ad, []]));
      kategoriler[kategori] = Array.from({ length: 24_000 }, (_, i) => ({
        code: '1101',
        name: `Yapay Ürün ${i}`,
        category: kategori,
        price_without_vat: 125,
        price_with_vat: 126.25,
      }));
      let son = performance.now(),
        enUzun = 0,
        tik = 0;
      const zaman = setInterval(() => {
        const simdi = performance.now();
        enUzun = Math.max(enUzun, simdi - son);
        son = simdi;
        tik++;
      }, 10);
      const baslangic = performance.now();
      const isci = new Worker(`/CAL_bup/assets/${dosya}`, { type: 'module' });
      try {
        const sonuc = await new Promise<{
          tur: string;
          mesaj?: string;
          onizleme?: { satirlar: { degerler: (number | string)[] }[]; istatistik: { product_count: number } };
        }>((coz, reddet) => {
          isci.onmessage = (e) => coz(e.data);
          isci.onerror = () => reddet(new Error('Yapay iskonto işlemi başarısız.'));
          isci.postMessage({
            tur: 'onizle',
            belgeler: [{ ad: 'Yapay.pdf', tip: 'normal', kategoriler }],
            oranlar: Object.fromEntries(adlar.map((ad) => [ad, 10])),
            tarih: '2026-10-04T12:00:00',
          });
        });
        return {
          sureMs: performance.now() - baslangic,
          enUzunBeklemeMs: enUzun,
          tik,
          tur: sonuc.tur,
          mesaj: sonuc.mesaj,
          urun: sonuc.onizleme?.istatistik.product_count,
          ilk: sonuc.onizleme?.satirlar[0]?.degerler,
          son: sonuc.onizleme?.satirlar.at(-1)?.degerler,
        };
      } finally {
        isci.terminate();
        clearInterval(zaman);
      }
    },
    { dosya: isciDosyasi, adlar: ISKONTO_KATEGORILERI },
  );
  await writeFile(join(tmpdir(), 'cal-iskonto-performans.json'), JSON.stringify(olcum, null, 2));
  expect(olcum.tur).toBe('onizleme');
  expect(olcum.urun).toBe(24_000);
  expect(olcum.ilk?.[2]).toBe('Yapay Ürün 0');
  expect(olcum.son?.[2]).toBe('Yapay Ürün 23999');
  expect(olcum.ilk?.[4]).toBe(113.62);
  expect(olcum.son?.[4]).toBe(113.62);
  expect(olcum.tik).toBeGreaterThan(10);
  expect(olcum.enUzunBeklemeMs).toBeLessThan(1500);
});
