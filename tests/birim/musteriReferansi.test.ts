import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import referans from '../yardimci/veriler/musteriReferansi.json';
import { diziSayfa, type HucreDegeri, type Kitap } from '../../src/kaynaklar/kitap';
import { MusteriOkumaHatasi, musteriListesiOku } from '../../src/kaynaklar/musteriListesi';
import { musterileriKarsilastir } from '../../src/cekirdek/musteriTakip/karsilastir';
import { musteriCiktisi } from '../../src/cekirdek/musteriTakip/cikti';
import { musteriExcelOlustur } from '../../src/satis/musteriTakip/motor';

function kitap(satirlar: readonly (readonly HucreDegeri[])[]): Kitap {
  return { dosyaAdi: 'Yapay.xlsx', olusturulma: null, sayfalar: [diziSayfa('Yapay', satirlar)] };
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

describe('Müşteri Takip — bağımsız Python okuyucu/facade/Excel başvurusu', () => {
  for (const ornek of referans.senaryolar) {
    const ad = `${ornek.ad} · ${ornek.harfDuyarli ? 'duyarlı' : 'duyarsız'}`;
    it(`${ad}: okuma ve iki yön birebir`, () => {
      const eski = musteriListesiOku(kitap(ornek.eski));
      const yeni = musteriListesiOku(kitap(ornek.yeni));
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
    it(`${ornek.ad}: Python ile aynı hata sınıfı`, () => {
      const kod =
        ornek.hataTuru === 'HeaderNotFoundError'
          ? 'BASLIK_YOK'
          : ornek.hataTuru === 'CariColumnNotFoundError'
            ? 'SUTUN_YOK'
            : 'GECERSIZ';
      try {
        musteriListesiOku(kitap(ornek.satirlar));
        expect.fail('Okuma reddedilmeliydi.');
      } catch (hata) {
        expect(hata).toBeInstanceOf(MusteriOkumaHatasi);
        expect((hata as MusteriOkumaHatasi).kod).toBe(kod);
      }
    });
  }
});
