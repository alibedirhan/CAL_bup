import { beforeAll, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { PyodideInterface } from 'pyodide';
import { nodePythonMotoru } from '../yardimci/pythonMotoru';
import { pythonCalistir } from '../../src/platform/python/motor';
import {
  bosKarlilikKaydi,
  type KarlilikKaydi,
  type KarlilikCevabi,
} from '../../src/cekirdek/karlilik/turler';
import referans from '../yardimci/veriler/karlilikReferansi.json';
let p: PyodideInterface;
beforeAll(async () => {
  p = await nodePythonMotoru('karlilik');
}, 60_000);
type Cevap = KarlilikCevabi & { yol?: string; mesaj?: string };
function calistir(
  s: (typeof referans.senaryolar)[number],
  eylem = 'analiz',
  alanlar: Record<string, unknown> = {},
  kayit = bosKarlilikKaydi(),
): Cevap {
  p.FS.mkdirTree('/cal/girdiler');
  for (const tur of ['satis', 'fiyat'] as const)
    p.FS.writeFile(`/cal/girdiler/${tur}.xlsx`, new Uint8Array(Buffer.from(s.girdiler[tur], 'base64')));
  return pythonCalistir(p, {
    tur: 'karlilik',
    eylem,
    kayit,
    tarih: '2026-10-04T12:00:00',
    satis: '/cal/girdiler/satis.xlsx',
    fiyat: '/cal/girdiler/fiyat.xlsx',
    ...alanlar,
  }) as Cevap;
}
async function excel(yol: string) {
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
    ) as { ad: string; satirlar: unknown[][] }[];
  } finally {
    p.globals.delete('cal_excel_yol');
  }
}
it('kârlılık kaynak okuyucu, domain, facade, depo ve Excel adaptörleri byte düzeyinde eşleşir', () => {
  for (const [ad, sha] of Object.entries(referans.kaynakSha256))
    expect(
      createHash('sha256')
        .update(readFileSync('vendor/python/bup/' + ad))
        .digest('hex'),
    ).toBe(sha);
});
for (const s of referans.senaryolar) {
  it(`${s.ad}: okuyucu, analiz ve genel bakış masaüstü başvurusuyla aynı`, () => {
    const c = calistir(s);
    expect(c.tur).toBe('analiz');
    expect(c.sonuc?.ozet).toEqual(s.ozet);
    expect(c.sonuc?.genelBakis).toEqual(s.genelBakis);
    expect(c.sonuc?.eslesme).toEqual(s.eslesme);
    p.FS.mkdirTree('/cal/girdiler');
    for (const tur of ['satis', 'fiyat'] as const)
      p.FS.writeFile(`/cal/girdiler/${tur}.xlsx`, new Uint8Array(Buffer.from(s.girdiler[tur], 'base64')));
    expect(
      JSON.parse(
        p.runPython(
          "json.dumps([asdict(r) for r in __import__('infrastructure.excel.profitability_workbook_reader',fromlist=['OpenpyxlProfitabilityWorkbookReader']).OpenpyxlProfitabilityWorkbookReader().read_price_report('/cal/girdiler/fiyat.xlsx')])",
        ) as string,
      ),
    ).toEqual(s.fiyatSatirlari);
    expect(
      JSON.parse(
        p.runPython(
          "json.dumps([asdict(r) for r in __import__('infrastructure.excel.profitability_workbook_reader',fromlist=['OpenpyxlProfitabilityWorkbookReader']).OpenpyxlProfitabilityWorkbookReader().read_profitability_report('/cal/girdiler/satis.xlsx')])",
        ) as string,
      ),
    ).toEqual(s.satisSatirlari);
  });
  it(`${s.ad}: tam/görünen Excel hücreleri ve sıralanmış kapsam aynı`, async () => {
    expect(await excel(calistir(s, 'excel').yol ?? '')).toEqual(s.tamExcel);
    expect(await excel(calistir(s, 'gorunen', { satirlar: s.gorunen }).yol ?? '')).toEqual(s.gorunenExcel);
  });
  for (const [i, sc] of s.senaryolar.entries())
    it(`${s.ad}: senaryo ${i}, marj/Pareto/başabaş ve bütün çıktı hücreleri aynı`, async () => {
      expect(calistir(s, 'senaryo', { oranlar: sc.oranlar }).sonuc?.senaryo).toEqual(sc.sonuc);
      expect(await excel(calistir(s, 'senaryo-excel', { oranlar: sc.oranlar }).yol ?? '')).toEqual(sc.excel);
    });
}
for (const e of referans.hatalar)
  it(`${e.ad}: özgün okuyucu hatası başarıya çevrilmez`, () => {
    p.FS.mkdirTree('/cal/girdiler');
    p.FS.writeFile('/cal/girdiler/hata.xlsx', new Uint8Array(Buffer.from(e.bayt, 'base64')));
    const c = pythonCalistir(p, {
      tur: 'karlilik',
      eylem: 'analiz',
      kayit: bosKarlilikKaydi(),
      tarih: '2026-10-04T12:00:00',
      satis: '/cal/girdiler/hata.xlsx',
      fiyat: '/cal/girdiler/hata.xlsx',
    }) as Cevap;
    // Fiyat önce okunur; satış başvurusunu bağımsız okuyucuda ayrıca doğrula.
    expect(c.tur).toBe('hata');
    p.FS.mkdirTree('/cal/girdiler');
    p.FS.writeFile('/cal/girdiler/hata.xlsx', new Uint8Array(Buffer.from(e.bayt, 'base64')));
    const actual = JSON.parse(
      p.runPython(`
from infrastructure.excel.profitability_workbook_reader import OpenpyxlProfitabilityWorkbookReader
try:
    OpenpyxlProfitabilityWorkbookReader().read_profitability_report('/cal/girdiler/hata.xlsx')
except Exception as error:
    actual_error = {'hata':type(error).__name__,'mesaj':str(error)}
json.dumps(actual_error)
`) as string,
    ) as unknown;
    expect(actual).toEqual({ hata: e.hata, mesaj: e.mesaj });
  });
it('öneri/onay/kaldırma/geri alma kaynak geçişleriyle aynı; öneri hesap değiştirmez', () => {
  const s = referans.senaryolar[0];
  if (!s) throw new Error('Başvuru yok.');
  let kayit = bosKarlilikKaydi();
  const temizle = (e: unknown) =>
    JSON.parse(
      JSON.stringify(e, (k, v: unknown) =>
        ['created_at', 'updated_at', 'occurred_at'].includes(k) ? 'saat-portu' : v,
      ),
    ) as unknown;
  for (const step of s.eslesmeAdimlari ?? []) {
    const c = calistir(
      s,
      step.eylem === 'geri-al' ? 'eslesme-geri' : step.eylem,
      { alias: 'YAPAY TAKMA', target: 'YAPAY ALFA' },
      kayit,
    );
    expect(c.tur).toBe('analiz');
    expect(c.sonuc?.ozet).toEqual(step.ozet);
    expect(temizle(c.sonuc?.eslesme)).toEqual(temizle(step.eslesme));
    kayit = c.kayit ?? kayit;
  }
});
it('iki dönem kaydı, metrik/ürün değişimleri bağımsız kaynakla aynı; silme geri alınabilir', () => {
  const first = referans.senaryolar[0],
    second = referans.senaryolar[4];
  if (!first || !second) throw new Error('Başvuru yok.');
  const a = calistir(first, 'donem-kaydet', { ad: 'Yapay İlk' });
  const b = calistir(second, 'donem-kaydet', { ad: 'Yapay İkinci', tarih: '2026-10-04T12:00:01' }, a.kayit);
  expect(b.donemler).toEqual(referans.donemler);
  const c = calistir(
    first,
    'karsilastir',
    { ilk: referans.donemler[0]?.id, ikinci: referans.donemler[1]?.id },
    b.kayit,
  );
  expect(c.karsilastirma).toEqual(referans.karsilastirma);
  const d = calistir(first, 'donem-sil', { id: referans.donemler[0]?.id }, b.kayit);
  expect(d.donemler).toHaveLength(1);
  expect(calistir(first, 'donem-geri', {}, d.kayit).donemler).toEqual(referans.donemler);
});
it('bozuk kaynak depoları boş sayılmaz; sınırsız sayı/yanlış görünür seçim ve eski eşleşme reddedilir', () => {
  const s = referans.senaryolar[0];
  if (!s) throw new Error('Başvuru yok.');
  const bozuk: KarlilikKaydi = {
    ...bosKarlilikKaydi(),
    eslesmeler: { guncel: '{"schema_version":1,"revision":5,"aliases":[],"history":[]}', yedek: null },
  };
  expect(calistir(s, 'analiz', {}, bozuk).tur).toBe('hata');
  for (const indices of [[-1], [999], [0, 0], [true], []])
    expect(calistir(s, 'gorunen', { satirlar: indices }).tur).toBe('hata');
  expect(calistir(s, 'excel', { beklenenEslesmeler: 'eski' }).tur).toBe('hata');
  expect(
    calistir(s, 'senaryo', { oranlar: { cost_change_pct: 501, price_change_pct: 0, quantity_change_pct: 0 } })
      .tur,
  ).toBe('hata');
});
it('formül metni tam/görünen/senaryo çıktısında çalıştırılmaz', async () => {
  const s = referans.senaryolar[0];
  if (!s) throw new Error('Başvuru yok.');
  const c = calistir(s),
    i = c.sonuc?.ozet.rows.findIndex((r) => r.stock_name === '=YAPAY()');
  expect(i).toBeGreaterThanOrEqual(0);
  const out = await excel(calistir(s, 'gorunen', { satirlar: [i] }).yol ?? '');
  expect(out[0]?.satirlar[1]?.[0]).toBe("'=YAPAY()");
});

it('XML varlık bildirimi, satır/metin bütçesi ve sınırsız sayı gerçek Excel okumasında reddedilir', () => {
  const s = referans.senaryolar[0];
  if (!s) throw new Error('Başvuru yok.');
  for (const tur of ['satir', 'metin', 'sonsuz', 'xml']) {
    p.FS.mkdirTree('/cal/girdiler');
    p.FS.writeFile('/cal/girdiler/fiyat.xlsx', new Uint8Array(Buffer.from(s.girdiler.fiyat, 'base64')));
    p.globals.set('cal_yapay_tur', tur);
    p.runPython(`
from openpyxl import Workbook
book = Workbook()
book.active.append(['Stok İsmi', 'Satış Miktar', 'Ort Satış Fiyat', 'Satış Tutar'])
book.active.append(['YAPAY ALFA', 1, 'inf' if cal_yapay_tur == 'sonsuz' else 15, 15])
if cal_yapay_tur == 'satir': book.active.cell(100006, 1, 'YAPAY ALFA')
if cal_yapay_tur == 'metin': book.active.cell(2, 1, 'Y' * 513)
book.save('/cal/girdiler/satis.xlsx')
book.close()
if cal_yapay_tur == 'xml':
    import io, zipfile
    source = Path('/cal/girdiler/satis.xlsx').read_bytes()
    with zipfile.ZipFile(io.BytesIO(source)) as original, zipfile.ZipFile('/cal/girdiler/satis.xlsx', 'w') as output:
        for name in original.namelist():
            data = original.read(name)
            if name == 'xl/worksheets/sheet1.xml':
                data = b'<!DOCTYPE worksheet [<!ENTITY yapay "yasak">]>' + data.replace(b'YAPAY ALFA', b'&yapay;')
            output.writestr(name, data)
`);
    p.globals.delete('cal_yapay_tur');
    const cevap = pythonCalistir(p, {
      tur: 'karlilik',
      eylem: 'analiz',
      kayit: bosKarlilikKaydi(),
      tarih: '2026-10-04T12:00:00',
      satis: '/cal/girdiler/satis.xlsx',
      fiyat: '/cal/girdiler/fiyat.xlsx',
    }) as Cevap;
    expect(cevap.tur).toBe('hata');
    expect(cevap.sonuc).toBeUndefined();
    if (tur === 'sonsuz') expect(cevap.mesaj).toContain('sonlu olmayan');
  }
});
