import { beforeAll, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { nodePythonMotoru } from '../yardimci/pythonMotoru';
import referans from '../yardimci/veriler/musteriReferansi.json';
import type { HucreDegeri } from '../../src/kaynaklar/kitap';
import { musteriListeOku } from '../../src/satis/musteriTakip/okuyucu';
import { musterileriKarsilastir } from '../../src/cekirdek/musteriTakip/karsilastir';
import { musteriCiktisi } from '../../src/cekirdek/musteriTakip/cikti';
import { musteriExcelOlustur } from '../../src/satis/musteriTakip/motor';

vi.mock('../../src/platform/python/motor', async (original) => ({
  ...(await original<typeof import('../../src/platform/python/motor')>()),
  pythonMotoru: (await import('../yardimci/pythonMotoru')).nodePythonMotoru,
}));

async function oku(satirlar: readonly (readonly HucreDegeri[])[]) {
  const w = new ExcelJS.Workbook();
  const sheet = w.addWorksheet('Yapay');
  for (const r of satirlar) sheet.addRow([...r]);
  return musteriListeOku(
    { ad: 'Yapay.xlsx', bayt: new Uint8Array(await w.xlsx.writeBuffer()) },
    new AbortController().signal,
  );
}

async function hucreler(bayt: Uint8Array) {
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(bayt as unknown as ExcelJS.Buffer);
  return w.worksheets.map((s) => ({
    ad: s.name,
    satirlar: Array.from({ length: s.rowCount }, (_, r) =>
      Array.from({ length: s.columnCount }, (_, c) => {
        const h = s.getCell(r + 1, c + 1);
        return h.isMerged && h.master.address !== h.address ? null : h.value;
      }),
    ),
    birlesimler: (s.model.merges ?? []).sort(),
  }));
}

// Python motorunun soğuk açılışı ilk denemenin 5 sn sınırına yüklenmesin (Kârlılık/İskonto ile aynı yöntem).
beforeAll(async () => {
  await nodePythonMotoru('musteri');
}, 60_000);

describe('Müşteri Takip — bağımsız Python okuyucu/facade/Excel başvurusu', () => {
  for (const ornek of referans.senaryolar) {
    const ad = `${ornek.ad} · ${ornek.harfDuyarli ? 'duyarlı' : 'duyarsız'}`;
    it(`${ad}: okuma ve iki yön birebir`, async () => {
      const eski = await musteriListeOku(
        { ad: 'Yapay.xlsx', bayt: new Uint8Array(Buffer.from(ornek.eskiBayt, 'base64')) },
        new AbortController().signal,
      );
      const yeni = await musteriListeOku(
        { ad: 'Yapay.xlsx', bayt: new Uint8Array(Buffer.from(ornek.yeniBayt, 'base64')) },
        new AbortController().signal,
      );
      expect(eski.musteriler).toEqual(ornek.okunanEski);
      expect(yeni.musteriler).toEqual(ornek.okunanYeni);
      expect(musterileriKarsilastir(eski, yeni, ornek.harfDuyarli, ornek.plasiyerler)).toEqual(ornek.sonuc);
    });
    it(`${ad}: tam ve görünen Excel hücreleri birebir`, async () => {
      const sonuc = ornek.sonuc;
      const signal = new AbortController().signal;
      const tam = await musteriExcelOlustur(musteriCiktisi(sonuc, ornek.plasiyerler), signal);
      expect(await hucreler(tam)).toEqual(ornek.tamExcel);
      if (ornek.gorunenYeniExcel) {
        const gorunen = musteriCiktisi(sonuc, ornek.plasiyerler, {
          yon: 'yeni',
          satirlar: [...sonuc.yeniler].reverse(),
        });
        expect(await hucreler(await musteriExcelOlustur(gorunen, signal))).toEqual(ornek.gorunenYeniExcel);
      }
    });
  }
  for (const ornek of referans.hatalar) {
    it(`${ornek.ad}: kaynak okuyucu da reddeder`, async () => {
      await expect(oku(ornek.satirlar)).rejects.toThrow();
    });
  }
});
