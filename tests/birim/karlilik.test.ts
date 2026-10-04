import { expect, it, vi, beforeEach } from 'vitest';
import {
  excelGirdisiniDogrula,
  karlilikKaydiniDogrula,
  senaryoOranlariniDogrula,
  sonucuDogrula,
} from '../../src/cekirdek/karlilik/dogrulama';
import {
  bosKarlilikKaydi,
  SIFIR_SENARYO,
  type KarlilikIstegi,
  type KarlilikSonucu,
} from '../../src/cekirdek/karlilik/turler';
import { karlilikIslemi } from '../../src/satis/karlilik/servis';
import type { KarlilikMotoru } from '../../src/satis/karlilik/portlar';
import { karlilikKaydiniOku, karlilikKaydiniYaz } from '../../src/platform/karlilikDeposu';
import { okuKesin, guncelle } from '../../src/platform/idb';
import referans from '../yardimci/veriler/karlilikReferansi.json';
vi.mock('../../src/platform/idb', () => ({ okuKesin: vi.fn(), guncelle: vi.fn() }));
const signal = () => new AbortController().signal;
const dosya = { ad: 'Yapay.xlsx', bayt: new Uint8Array([80, 75, 3, 4]) };
const istek: KarlilikIstegi = {
  tur: 'karlilik',
  eylem: 'analiz',
  kayit: bosKarlilikKaydi(),
  tarih: '2026-10-04T12:00:00',
  satis: dosya,
  fiyat: dosya,
};
const kaynak = referans.senaryolar[0];
if (!kaynak) throw new Error('Başvuru yok.');
const sonuc = {
  ozet: kaynak.ozet,
  genelBakis: kaynak.genelBakis,
  senaryo: kaynak.senaryolar[0]?.sonuc,
  eslesme: kaynak.eslesme,
} as KarlilikSonucu;
beforeEach(() => vi.resetAllMocks());
it.each(['../Yapay.xlsx', 'Yapay.xlsm', 'x\\Yapay.xlsx', 'x\0.xlsx', 'x'.repeat(201) + '.xlsx'])(
  'Excel adı reddedilir: %s',
  (ad) => expect(() => excelGirdisiniDogrula(ad, 4, dosya.bayt)).toThrow(),
);
it.each([0, -1, NaN, Infinity, 25 * 1024 * 1024 + 1])('Excel boyutu okumadan önce reddedilir: %s', (n) =>
  expect(() => excelGirdisiniDogrula(dosya.ad, n)).toThrow(),
);
it('Excel imzası ve bildirilen boyut uyuşur', () => {
  expect(() => excelGirdisiniDogrula(dosya.ad, 4, dosya.bayt)).not.toThrow();
  expect(() => excelGirdisiniDogrula(dosya.ad, 4, new Uint8Array(4))).toThrow();
  expect(() => excelGirdisiniDogrula(dosya.ad, 5, dosya.bayt)).toThrow();
});
it.each([-101, 501, NaN, Infinity])('senaryo oran sınırı: %s', (v) =>
  expect(() => senaryoOranlariniDogrula({ ...SIFIR_SENARYO, cost_change_pct: v })).toThrow(),
);
it.each([
  null,
  {},
  { ...bosKarlilikKaydi(), surum: 2 },
  { ...bosKarlilikKaydi(), nesil: NaN },
  { ...bosKarlilikKaydi(), fazla: true },
  { ...bosKarlilikKaydi(), eslesmeler: { guncel: '[]', yedek: null } },
  { ...bosKarlilikKaydi(), eslesmeler: { guncel: 'x'.repeat(512 * 1024 + 1), yedek: null } },
])('bozuk/sınırsız kayıt boş sayılmaz', (v) => expect(() => karlilikKaydiniDogrula(v)).toThrow());
it('sonuç sayı/kapsam hatası reddedilir', () => {
  expect(sonucuDogrula(sonuc)).toEqual(sonuc);
  expect(() => sonucuDogrula({ ...sonuc, ozet: { ...sonuc.ozet, total_count: 999 } })).toThrow();
  expect(() => sonucuDogrula({ ...sonuc, ozet: { ...sonuc.ozet, total_net_profit: Infinity } })).toThrow();
});
it('eksik dosya/iptal/geçersiz oran motoru çağırmaz; işlem sırasında iptal sonucu dışlar', async () => {
  const motor: KarlilikMotoru = { calistir: vi.fn().mockResolvedValue({ tur: 'analiz', sonuc }) };
  await expect(
    karlilikIslemi(motor, { ...istek, fiyat: { ...dosya, bayt: new Uint8Array(4) } }, signal()),
  ).rejects.toThrow();
  await expect(
    karlilikIslemi(motor, { ...istek, oranlar: { ...SIFIR_SENARYO, cost_change_pct: NaN } }, signal()),
  ).rejects.toThrow();
  const c = new AbortController();
  c.abort();
  await expect(karlilikIslemi(motor, istek, c.signal)).rejects.toThrow();
  expect(motor.calistir).not.toHaveBeenCalled();
  const d = new AbortController();
  motor.calistir = vi.fn(async () => {
    d.abort();
    return { tur: 'analiz' as const, sonuc };
  });
  await expect(karlilikIslemi(motor, istek, d.signal)).rejects.toThrow();
});
it('depo okuma hatası yeni boş kayıt sayılmaz', async () => {
  vi.mocked(okuKesin).mockRejectedValue(new Error('engelli'));
  await expect(karlilikKaydiniOku()).rejects.toThrow();
});
it('iki depo/yedek tek aktarımda yazılır, eski sekme nesli güncel kaydı ezmez', async () => {
  const eski = bosKarlilikKaydi(),
    yeni = {
      ...eski,
      eslesmeler: { guncel: '{"schema_version":1,"revision":0,"aliases":[],"history":[]}', yedek: null },
    };
  let veri: unknown = undefined;
  vi.mocked(guncelle).mockImplementation(async (_, f) => {
    veri = f(veri, {} as IDBObjectStore);
    return true;
  });
  expect((await karlilikKaydiniYaz(eski, yeni, signal())).nesil).toBe(1);
  const bir = structuredClone(veri);
  await expect(karlilikKaydiniYaz(eski, yeni, signal())).rejects.toThrow('başka sekmede');
  expect(veri).toEqual(bir);
});
it('başarısız/iptal depo aktarımı başarı vermez', async () => {
  vi.mocked(guncelle).mockResolvedValue(false);
  await expect(karlilikKaydiniYaz(bosKarlilikKaydi(), bosKarlilikKaydi(), signal())).rejects.toThrow(
    'saklanamadı',
  );
  const c = new AbortController();
  c.abort();
  vi.mocked(guncelle).mockClear();
  await expect(karlilikKaydiniYaz(bosKarlilikKaydi(), bosKarlilikKaydi(), c.signal)).rejects.toThrow();
  expect(guncelle).not.toHaveBeenCalled();
});

it('başarı türündeki eksik motor yanıtı sonuç sayılmaz', async () => {
  const motor: KarlilikMotoru = { calistir: vi.fn().mockResolvedValue({ tur: 'analiz' }) };
  await expect(karlilikIslemi(motor, istek, signal())).rejects.toThrow('yanıtı eksik');
});
