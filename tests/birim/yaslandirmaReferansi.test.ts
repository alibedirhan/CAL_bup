import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { PyodideInterface } from 'pyodide';
import { nodePythonMotoru } from '../yardimci/pythonMotoru';
import { pythonCalistir } from '../../src/platform/python/motor';
import referans from '../yardimci/veriler/yaslandirmaReferansi.json';

// Masaüstünün özgün Python hattı yalnız yapay dosyalarla çalıştırılıp kaydedildi
// (tools/yaslandirmaReferansi.py). Aynı girdiler tarayıcı Python motorunda yeniden çalışır.
let p: PyodideInterface;
beforeAll(async () => {
  p = await nodePythonMotoru('yaslandirma');
}, 60_000);

type Cevap = Record<string, unknown> & { tur: string; mesaj?: string; yol?: string; ad?: string };
const YOL = '/cal/girdiler/yaslandirma.xlsx';
function calistir(bayt: string, alanlar: Record<string, unknown>): Cevap {
  p.FS.mkdirTree('/cal/girdiler');
  p.FS.writeFile(YOL, new Uint8Array(Buffer.from(bayt, 'base64')));
  return pythonCalistir(p, {
    tur: 'yaslandirma',
    yol: YOL,
    tarih: '2026-10-06T09:30:00',
    ...alanlar,
  }) as Cevap;
}
function excel(yol: string) {
  p.globals.set('cal_excel_yol', yol);
  try {
    return JSON.parse(
      p.runPython(`
from openpyxl import load_workbook
book = load_workbook(cal_excel_yol, data_only=False)
try:
    cells = [{'ad': s.title, 'satirlar': [list(r) for r in s.values]} for s in book]
finally:
    book.close()
json.dumps(cells)
`) as string,
    ) as unknown;
  } finally {
    p.globals.delete('cal_excel_yol');
  }
}

describe('Yaşlandırma — masaüstü başvurusuyla eşdeğerlik', () => {
  it('okuyucu, domain, facade, rapor, Excel ve atama kaynakları byte düzeyinde aynı', () => {
    for (const [ad, sha] of Object.entries(referans.kaynakSha256))
      expect(
        createHash('sha256')
          .update(readFileSync('vendor/python/bup/' + ad))
          .digest('hex'),
        ad,
      ).toBe(sha);
  });

  for (const s of referans.senaryolar) {
    it(`${s.ad}: okuma, araç/kova hesabı ve dört rapor aynı`, () => {
      const c = calistir(s.bayt, { eylem: 'analiz' }) as Cevap & {
        sonuc: { ozet: unknown; raporlar: unknown };
      };
      expect(c.tur).toBe('analiz');
      expect(c.sonuc.ozet).toEqual(s.ozet);
      expect(c.sonuc.raporlar).toEqual(s.raporlar);
      p.FS.mkdirTree('/cal/girdiler');
      p.FS.writeFile(YOL, new Uint8Array(Buffer.from(s.bayt, 'base64')));
      expect(
        JSON.parse(
          p.runPython(
            `from infrastructure.excel.aging_workbook_reader import OpenpyxlAgingWorkbookReader as R
_r = R().read_aging_report('${YOL}')
json.dumps({'satirlar': [asdict(x) for x in _r.rows], 'kovalar': list(_r.bucket_columns)}, ensure_ascii=False)`,
          ) as string,
        ),
      ).toEqual(s.okunan);
    });
    it(`${s.ad}: tam Excel ve görünen araçlar Excel hücreleri aynı`, () => {
      const tam = calistir(s.bayt, { eylem: 'excel' });
      expect(tam).toMatchObject({ tur: 'dosya', ad: 'Yaslandirma_Analizi.xlsx' });
      expect(excel(String(tam.yol))).toEqual(s.tamExcel);
      if (!s.gorunen.length) {
        expect(calistir(s.bayt, { eylem: 'gorunen', araclar: [] }).tur).toBe('hata');
        return;
      }
      const gorunen = calistir(s.bayt, { eylem: 'gorunen', araclar: s.gorunen });
      expect(gorunen).toMatchObject({ tur: 'dosya', ad: 'Yaslandirma_Gorunen_Araclar.xlsx' });
      expect(excel(String(gorunen.yol))).toEqual(s.gorunenExcel);
    });
  }

  it('güncel analizde olmayan veya yinelenen görünen araç seçimi reddedilir', () => {
    const s = referans.senaryolar[0];
    if (!s) throw new Error('Yapay senaryo eksik');
    for (const araclar of [['99'], ['1', '1'], 'x', [1]])
      expect(calistir(s.bayt, { eylem: 'gorunen', araclar }).tur).toBe('hata');
  });

  for (const h of referans.hatalar)
    it(`hatalı dosya (${h.ad}) kaynak mesajıyla reddedilir`, () => {
      expect(calistir(h.bayt, { eylem: 'analiz' })).toEqual({ tur: 'hata', mesaj: h.mesaj });
    });

  it('atama ekle/güncelle/hata/kaldır/geri al adımları ve kayıt metni aynı', () => {
    let kayit: { guncel: string | null; yedek: string | null } = { guncel: null, yedek: null };
    for (const adim of referans.atamaAdimlari) {
      const alanlar = (adim as { alanlar?: Record<string, string> }).alanlar ?? {};
      const istek =
        adim.eylem === 'bos'
          ? { eylem: 'atama' }
          : adim.eylem === 'ata'
            ? {
                eylem: 'ata',
                atama: { email: '', telefon: '', departman: '', notlar: '', ...alanlar },
              }
            : adim.eylem === 'kaldir'
              ? { eylem: 'kaldir', aracNo: alanlar.arac_no }
              : { eylem: 'geri-al' };
      const c = pythonCalistir(p, {
        tur: 'yaslandirma',
        tarih: '2026-10-06T09:30:00',
        kayit,
        ...istek,
      }) as Cevap & { kayit: typeof kayit };
      if (adim.hata && adim.hata !== 'geri-alinamadi') {
        expect(c).toEqual({ tur: 'hata', mesaj: adim.hata.slice(adim.hata.indexOf(': ') + 2) });
        continue;
      }
      expect(c.tur, adim.eylem).toBe('atama');
      expect(c.liste).toEqual(adim.liste);
      expect(c.isYuku).toEqual(adim.isYuku);
      expect(c.geriAlinabilir).toBe(adim.geriAlinabilir);
      expect(c.kayit).toEqual(adim.kayit);
      kayit = c.kayit;
    }
  });

  it('bozuk veya sınır aşan atama kaydı boş sayılmaz, reddedilir', () => {
    for (const kayit of [
      { guncel: '{"assignments": "x"}', yedek: null },
      { guncel: '[]', yedek: null },
      { guncel: 'NaN', yedek: null },
      { guncel: 'x'.repeat(600 * 1024), yedek: null },
      { guncel: null },
    ])
      expect(
        pythonCalistir(p, { tur: 'yaslandirma', eylem: 'atama', tarih: '2026-10-06T09:30:00', kayit }),
      ).toMatchObject({
        tur: 'hata',
      });
  });
});
