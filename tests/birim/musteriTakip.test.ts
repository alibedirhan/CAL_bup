import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { musteriMotoru } from '../../src/satis/musteriTakip/motor';
import { musteriKarsilastirmasi } from '../../src/satis/musteriTakip/servis';
import { musteriCiktisi } from '../../src/cekirdek/musteriTakip/cikti';
import { musterileriKarsilastir } from '../../src/cekirdek/musteriTakip/karsilastir';
import { harfKatla } from '../../src/cekirdek/musteriTakip/metin';
import { plasiyerKaydiniDogrula } from '../../src/cekirdek/musteriTakip/plasiyer';
import type { MusteriMotoru } from '../../src/satis/musteriTakip/portlar';
import type { MusteriListesi } from '../../src/cekirdek/musteriTakip/turler';

vi.mock('../../src/platform/python/motor', async (original) => ({
  ...(await original<typeof import('../../src/platform/python/motor')>()),
  pythonMotoru: (await import('../yardimci/pythonMotoru')).nodePythonMotoru,
}));

const eski: MusteriListesi = { depo: null, baslikSatiri: 0, musteriler: ['Yapay Alfa', 'Yapay Beta'] };
const yeni: MusteriListesi = { depo: null, baslikSatiri: 0, musteriler: ['Yapay Alfa', 'Yapay Gamma'] };
const dosya = { ad: 'Yapay.xlsx', bayt: new Uint8Array() };

describe('Müşteri Takip sınırlar ve uygulama servisi', () => {
  it('gerçek XLSX: birleşik cari tekrar edilmez, formülde önbellek kullanılır', async () => {
    const w = new ExcelJS.Workbook();
    const s = w.addWorksheet('Yapay');
    s.getCell('A1').value = 'Cari Ünvan';
    s.mergeCells('A2:A3');
    s.getCell('A2').value = 'Yapay Alfa';
    s.getCell('A4').value = { formula: '"Yapay Beta"', result: 'Yapay Beta' };
    s.getCell('A5').value = { formula: '"Yapay Hesaplanmamış"' };
    s.getCell('A6').value = false;
    s.getCell('A7').value = new Date('2026-10-04T00:00:00Z');
    const liste = await musteriMotoru.listeOku(
      { ...dosya, bayt: new Uint8Array(await w.xlsx.writeBuffer()) },
      new AbortController().signal,
    );
    expect(liste.musteriler).toEqual(['Yapay Alfa', 'Yapay Beta', 'False', '2026-10-04 00:00:00']);
  });
  it('bozuk ZIP ve makrolu uzantı reddedilir', async () => {
    const signal = new AbortController().signal;
    await expect(
      musteriMotoru.listeOku({ ad: 'Yapay.xlsx', bayt: new Uint8Array([1, 2, 3]) }, signal),
    ).rejects.toThrow();
    await expect(musteriMotoru.listeOku({ ...dosya, ad: 'Yapay.xlsm' }, signal)).rejects.toThrow(
      'Yalnızca .xlsx',
    );
  });
  it('XLSX içindeki XML varlık bildirimi güvenli XML adaptörüyle reddedilir', async () => {
    const w = new ExcelJS.Workbook();
    const s = w.addWorksheet('Yapay');
    s.addRow(['Cari Ünvan']);
    s.addRow(['Yapay Alfa']);
    const zip = await JSZip.loadAsync(await w.xlsx.writeBuffer());
    const yol = 'xl/worksheets/sheet1.xml';
    const xml = await zip.file(yol)?.async('string');
    if (!xml) throw new Error('Yapay sayfa yok.');
    zip.file(yol, xml.replace(/(<\?xml[^?]*\?>)/, '$1<!DOCTYPE worksheet [<!ENTITY yapay "Yapay varlık">]>'));
    const bayt = await zip.generateAsync({ type: 'uint8array' });
    await expect(
      musteriMotoru.listeOku({ ad: 'Yapay.xlsx', bayt }, new AbortController().signal),
    ).rejects.toThrow();
  });
  it('ikinci okuma başarısızsa tamamlanmış oturum dönmez', async () => {
    const oku = vi.fn().mockResolvedValueOnce(eski).mockRejectedValueOnce(new Error('yapay hata'));
    const motor: MusteriMotoru = { listeOku: oku, excelOlustur: vi.fn() };
    await expect(
      musteriKarsilastirmasi(motor, dosya, dosya, false, {}, new AbortController().signal),
    ).rejects.toThrow('yapay hata');
    expect(oku).toHaveBeenCalledTimes(2);
  });
  it('ilk okuma sırasında iptal ikinci okumayı başlatmaz', async () => {
    const c = new AbortController();
    const oku = vi.fn(async () => {
      c.abort();
      return eski;
    });
    await expect(
      musteriKarsilastirmasi({ listeOku: oku, excelOlustur: vi.fn() }, dosya, dosya, false, {}, c.signal),
    ).rejects.toThrow();
    expect(oku).toHaveBeenCalledTimes(1);
  });
  it('iptal edilmiş Excel işi yazımı başlatmaz', async () => {
    const c = new AbortController();
    c.abort();
    const cikti = musteriCiktisi(musterileriKarsilastir(eski, yeni), {});
    await expect(musteriMotoru.excelOlustur(cikti, c.signal)).rejects.toThrow();
  });
  it.each([[], ['Yapay Olmayan'], ['Yapay Beta', 'Yapay Beta']].map((satirlar) => ({ satirlar })))(
    'boş/eski/tekrar eden görünür seçim reddedilir: $satirlar',
    ({ satirlar }) => {
      expect(() =>
        musteriCiktisi(musterileriKarsilastir(eski, yeni), {}, { yon: 'eksik', satirlar }),
      ).toThrow();
    },
  );
  it('arama katlaması Python gibi Türkçe ı ile i harfini birleştirmez', () => {
    expect(harfKatla('Straße IŞIK İŞIK ı')).toBe('strasse işik i̇şik ı');
  });
  it('plasiyer sonradan değişirse dosya önerisi karşılaştırma anını, başlık güncel ayarı korur', () => {
    const sonuc = musterileriKarsilastir({ ...eski, depo: 'İZMİR ARAÇ 06' }, yeni, false, {
      '06': 'Yapay Eski',
    });
    const cikti = musteriCiktisi(sonuc, { '06': 'Yapay Yeni' });
    expect(cikti.ad).toBe('Arac_06_Yapay Eski');
    expect(cikti.baslik).toBe('Araç 06 - Yapay Yeni');
  });
  it.each([
    null,
    [],
    {},
    { surum: 2 },
    { surum: 1, nesil: 0, plasiyerler: { '1': 'Yapay' }, yedek: null },
    { surum: 1, nesil: -1, plasiyerler: {}, yedek: null },
    { surum: 1, nesil: 0, plasiyerler: {}, yedek: null, fazla: true },
  ])('bozuk plasiyer kaydı boş ayar sayılmaz: %j', (kayit) => {
    expect(() => plasiyerKaydiniDogrula(kayit)).toThrow();
  });
  it('yeni kayıt ve önceki değişiklik birlikte doğrulanır', () => {
    expect(plasiyerKaydiniDogrula(undefined).nesil).toBe(0);
    expect(
      plasiyerKaydiniDogrula({
        surum: 1,
        nesil: 2,
        plasiyerler: { '06': ' Yapay ' },
        yedek: { '07': 'Yapay Eski' },
      }).plasiyerler,
    ).toEqual({ '06': 'Yapay' });
  });
});
