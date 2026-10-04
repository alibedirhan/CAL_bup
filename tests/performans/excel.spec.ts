import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const senaryolar = [
  { ad: 'aylik-kitap', sayfa: 31, satir: 250, sutun: 10, kabul: true },
  { ad: 'satir-siniri', sayfa: 1, satir: 100_000, sutun: 4, kabul: true },
  { ad: 'sutun-siniri', sayfa: 1, satir: 2_000, sutun: 256, kabul: true },
  { ad: 'fazla-satir', sayfa: 1, satir: 100_001, sutun: 1, kabul: false },
  { ad: 'fazla-sutun', sayfa: 1, satir: 1, sutun: 257, kabul: false },
  { ad: 'fazla-sayfa', sayfa: 401, satir: 1, sutun: 1, kabul: false },
];

for (const s of senaryolar) {
  test(`büyük yapay Excel: ${s.ad}`, async ({ page }, bilgi) => {
    const wb = new ExcelJS.Workbook();
    for (let i = 0; i < s.sayfa; i++) {
      const ws = wb.addWorksheet(`Yapay ${i + 1}`);
      for (let r = 1; r <= s.satir; r++) {
        ws.addRow(Array.from({ length: s.sutun }, (_, c) => (c === 0 ? `Yapay ürün ${r}` : r + c)));
      }
    }
    const veri = Buffer.from(await wb.xlsx.writeBuffer());
    const motor = (await readdir('dist/assets')).find((ad) => /^motor-.*\.js$/.test(ad));
    if (!motor) throw new Error('Derlenmiş Excel motoru yok; önce npm run build çalıştırın.');
    await page.goto('/CAL_bup/');
    // Dosya hazırlama ve motor yükleme okuma süresine katılmaz.
    await page.evaluate(
      async ({ bayt, motor }) => {
        const mod = await import(/* @vite-ignore */ `/CAL_bup/assets/${motor}`);
        Reflect.set(globalThis, 'yapayExcelOku', mod.kitapAc);
        Reflect.set(
          globalThis,
          'yapayExcelBayti',
          Uint8Array.from(atob(bayt), (h) => h.charCodeAt(0)),
        );
      },
      { bayt: veri.toString('base64'), motor },
    );
    const sonuc = await page.evaluate(async (sutun) => {
      const oku = Reflect.get(globalThis, 'yapayExcelOku') as (
        b: Uint8Array,
        a: string,
      ) => Promise<{
        kitap: { sayfalar: { sonSatir: number; hucre: (r: number, c: number) => unknown }[] };
      }>;
      const bayt = Reflect.get(globalThis, 'yapayExcelBayti') as Uint8Array;
      let son = performance.now();
      let enUzunBekleme = 0;
      const sayac = setInterval(() => {
        const simdi = performance.now();
        enUzunBekleme = Math.max(enUzunBekleme, simdi - son);
        son = simdi;
      }, 10);
      const bas = performance.now();
      let hata = '';
      let sayfa = 0;
      let satir = 0;
      let sonHucre: unknown;
      let sonSutunHucre: unknown;
      let sonSayfaHucre: unknown;
      try {
        const acik = await oku(bayt, 'Yapay.xlsx');
        sayfa = acik.kitap.sayfalar.length;
        const ilk = acik.kitap.sayfalar[0];
        satir = ilk?.sonSatir ?? 0;
        sonHucre = ilk?.hucre(satir, 1);
        sonSutunHucre = ilk?.hucre(satir, sutun);
        sonSayfaHucre = acik.kitap.sayfalar.at(-1)?.hucre(satir, sutun);
      } catch (e) {
        hata = e instanceof Error ? e.message : 'Bilinmeyen hata';
      }
      const sure = performance.now() - bas;
      await new Promise((r) => setTimeout(r, 20));
      clearInterval(sayac);
      Reflect.deleteProperty(globalThis, 'yapayExcelOku');
      Reflect.deleteProperty(globalThis, 'yapayExcelBayti');
      return {
        sureMs: Math.round(sure),
        enUzunBeklemeMs: Math.round(enUzunBekleme),
        hata,
        sayfa,
        satir,
        sonHucre,
        sonSutunHucre,
        sonSayfaHucre,
      };
    }, s.sutun);
    if (s.kabul) {
      expect(sonuc.hata).toBe('');
      expect(sonuc.sayfa).toBe(s.sayfa);
      expect(sonuc.satir).toBe(s.satir);
      expect(sonuc.sonHucre).toBe(`Yapay ürün ${s.satir}`);
      const sonDeger = s.sutun === 1 ? `Yapay ürün ${s.satir}` : s.satir + s.sutun - 1;
      expect(sonuc.sonSutunHucre).toBe(sonDeger);
      expect(sonuc.sonSayfaHucre).toBe(sonDeger);
    } else {
      expect(sonuc.hata).toContain('çok fazla sayfa, satır veya sütun');
    }
    const olcum = {
      senaryo: s,
      xlsxBayt: veri.length,
      ...sonuc,
      chromium: page.context().browser()?.version(),
      node: process.version,
    };
    await writeFile(join(tmpdir(), `cal-bup-excel-${s.ad}.json`), JSON.stringify(olcum, null, 2));
    await bilgi.attach('Yapay Excel ölçümü', {
      body: JSON.stringify(olcum),
      contentType: 'application/json',
    });
  });
}
