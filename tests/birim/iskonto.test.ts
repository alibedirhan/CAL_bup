import { describe, expect, it, vi } from 'vitest';
import {
  pdfGirdisiniDogrula,
  iskontoOranlariniDogrula,
  belgeleriDogrula,
  onizlemeyiDogrula,
} from '../../src/cekirdek/iskonto/dogrulama';
import { sifirOranlar, type IskontoBelgesi, type IskontoOnizlemesi } from '../../src/cekirdek/iskonto/turler';
import { fiyatListeleriniYukle, iskontoOnizle } from '../../src/satis/iskonto/servis';
import type { IskontoMotoru } from '../../src/satis/iskonto/portlar';
import referans from '../yardimci/veriler/iskontoReferansi.json';

const belge = referans.belgeler[0]?.belge as IskontoBelgesi;
const sonuc = referans.senaryolar[0]?.onizleme as IskontoOnizlemesi;
const pdf = { ad: 'Yapay.pdf', bayt: new Uint8Array([37, 80, 68, 70, 45]) };
function motor(): IskontoMotoru {
  return {
    yukle: vi.fn().mockResolvedValue({ belgeler: [belge], hatalar: [] }),
    onizle: vi.fn().mockResolvedValue(sonuc),
    cikti: vi.fn(),
  };
}

describe('İskonto — girdi/port sınırları ve işlem bütünlüğü', () => {
  it.each(['Yapay.xlsx', '../Yapay.pdf', 'A\\Yapay.pdf', 'A\0.pdf', 'x'.repeat(201) + '.pdf'])(
    'uzantı/yol reddedilir: %s',
    (ad) => expect(() => pdfGirdisiniDogrula(ad, 5, pdf.bayt)).toThrow(),
  );
  it.each([0, -1, NaN, Infinity, 25 * 1024 * 1024 + 1])('boyut okumadan önce reddedilir: %s', (boyut) =>
    expect(() => pdfGirdisiniDogrula(pdf.ad, boyut)).toThrow(),
  );
  it('uzantı yeterli değildir; PDF imzası ve bildirilen boyut eşleşir', () => {
    expect(() => pdfGirdisiniDogrula(pdf.ad, 5, new Uint8Array(5))).toThrow();
    expect(() => pdfGirdisiniDogrula(pdf.ad, 6, pdf.bayt)).toThrow();
    expect(() => pdfGirdisiniDogrula(pdf.ad, 5, pdf.bayt)).not.toThrow();
  });
  it.each([-1, 101, NaN, Infinity, -Infinity])('geçersiz oran hesap motoruna ulaşmaz: %s', async (oran) => {
    const m = motor();
    const oranlar = { ...sifirOranlar(), 'Bütün Piliç Ürünleri': oran };
    expect(() => iskontoOranlariniDogrula(oranlar)).toThrow();
    await expect(
      iskontoOnizle(m, [belge], oranlar, '2026-10-04T12:00:00', new AbortController().signal),
    ).rejects.toThrow();
    expect(m.onizle).not.toHaveBeenCalled();
  });
  it.each([
    null,
    {},
    [{}],
    [{ ...belge, tip: 'bilinmeyen' }],
    [{ ...belge, kategoriler: {} }],
    [{ ...belge, kategoriler: { ...belge.kategoriler, 'But Ürünleri': Array(25_001).fill({}) } }],
  ])('bozuk/bütçeyi aşan belge boş listeye çevrilmez: %j', (v) =>
    expect(() => belgeleriDogrula(v)).toThrow(),
  );
  it('önizlemede miktar ve satır sayısı tutmazsa veya fiyat sonlu değilse reddedilir', () => {
    expect(() =>
      onizlemeyiDogrula({ ...sonuc, istatistik: { ...sonuc.istatistik, product_count: 999 } }),
    ).toThrow();
    expect(() =>
      onizlemeyiDogrula({ ...sonuc, istatistik: { ...sonuc.istatistik, total_discount: NaN } }),
    ).toThrow();
  });
  it('geçersiz tek dosya geçerli PDF yüklemesini engellemez, hata açıkça korunur', async () => {
    const m = motor();
    const s = await fiyatListeleriniYukle(
      m,
      [pdf, { ad: 'Yapay bozuk.pdf', bayt: new Uint8Array(5) }],
      new AbortController().signal,
    );
    expect(s.belgeler).toEqual([belge]);
    expect(s.hatalar[0]?.ad).toBe('Yapay bozuk.pdf');
    expect(m.yukle).toHaveBeenCalledWith([pdf], expect.any(AbortSignal));
  });
  it('boş veya dörtlü seçim motoru başlatmaz', async () => {
    const m = motor();
    for (const dosyalar of [[], Array(4).fill(pdf)])
      await expect(fiyatListeleriniYukle(m, dosyalar, new AbortController().signal)).rejects.toThrow();
    expect(m.yukle).not.toHaveBeenCalled();
  });
  it('iptal edilmiş veya yükleme sırasında iptal edilen iş sonuç uygulamaz', async () => {
    const c = new AbortController(),
      m = motor();
    c.abort();
    await expect(fiyatListeleriniYukle(m, [pdf], c.signal)).rejects.toThrow();
    expect(m.yukle).not.toHaveBeenCalled();
    const d = new AbortController();
    m.yukle = vi.fn(async () => {
      d.abort();
      return { belgeler: [belge], hatalar: [] };
    });
    await expect(fiyatListeleriniYukle(m, [pdf], d.signal)).rejects.toThrow();
  });
});
