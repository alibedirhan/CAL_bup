import { afterEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { EN_BUYUK_DOSYA } from '../../src/cekirdek/dosya';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import { ayarGecerli } from '../../src/cekirdek/ayarDenetimi';
import { tarih } from '../../src/cekirdek/tarih';
import { sayiCevir } from '../../src/cekirdek/sayi';
import { kitapAc } from '../../src/kaynaklar/excel';
import { sayimOku } from '../../src/kaynaklar/led';
import { arsiviDenetle } from '../../src/kaynaklar/xlsxDenetimi';
import { ayarlariOku, ayarlariYaz } from '../../src/platform/ayarlar';
import { dosyaOku } from '../../src/platform/dosya';
import { gecmisCsv, type GecmisKaydi } from '../../src/platform/gecmis';
import { ambalajliSayimKitap } from '../yardimci/sentetik';

afterEach(() => vi.unstubAllGlobals());

describe('dosya sınırları', () => {
  it('büyük dosyayı belleğe almadan reddeder', async () => {
    const arrayBuffer = vi.fn();
    await expect(
      dosyaOku({ name: 'deneme.xlsx', size: EN_BUYUK_DOSYA + 1, arrayBuffer } as unknown as File),
    ).rejects.toThrow(/25 MB/);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it('makrolu dosyayı makrolarını kaybetmeden reddeder', async () => {
    await expect(dosyaOku(new File(['deneme'], 'deneme.xlsm'))).rejects.toThrow(/Makrolu/);
    await expect(kitapAc(new Uint8Array(), 'deneme.xlsm')).rejects.toThrow(/.xlsx/);
  });
  it('xlsx diye yeniden adlandırılan metni ve eksik arşivi reddeder', () => {
    expect(() => arsiviDenetle(new TextEncoder().encode('bu bir Excel değil'))).toThrow();
    expect(() => arsiviDenetle(new Uint8Array(25))).toThrow();
  });
  it('normal Excel arşivini kabul eder, açılan boyutu büyük görüneni reddeder', async () => {
    const w = new ExcelJS.Workbook();
    w.addWorksheet('Deneme').getCell('A1').value = 'Sentetik';
    const bayt = new Uint8Array(await w.xlsx.writeBuffer());
    expect(() => arsiviDenetle(bayt)).not.toThrow();
    const v = new DataView(bayt.buffer);
    let p = -1;
    for (let i = 0; i < bayt.length - 4; i++)
      if (v.getUint32(i, true) === 0x02014b50) {
        p = i;
        break;
      }
    expect(p).toBeGreaterThan(0);
    v.setUint32(p + 24, 60 * 1024 * 1024, true);
    expect(() => arsiviDenetle(bayt)).toThrow(/sınır/);
  });
});

describe('sayım birimi', () => {
  it.each(['ADET', 'KOLİ', '', 'GRAM'])('Birim sütunundaki %j miktarını kilogram saymaz', (birim) => {
    const k = ambalajliSayimKitap();
    const s = k.sayfalar[0];
    if (!s) throw new Error('Sayfa yok');
    const degisen = {
      ...k,
      sayfalar: [{ ...s, hucre: (r: number, c: number) => (r === 2 && c === 5 ? birim : s.hucre(r, c)) }],
    };
    expect(() => sayimOku(degisen, AYAR, tarih(2026, 10, 2))).toThrow(/kilogram/);
  });
  it('KG miktarlarını ambalaj adetlerini katmadan toplamayı korur', () => {
    expect(sayimOku(ambalajliSayimKitap(), AYAR, tarih(2026, 10, 2)).esasToplam()).toBe(25.75);
  });
});

describe('ayar doğrulaması', () => {
  it.each([
    { tolerans: -1 },
    { tolerans: Infinity },
    { tolerans: NaN },
    { hedefIlkSatir: 1 },
    { hedefIlkSatir: 4.5 },
    { hedefIlkSatir: 100001 },
    { donukOnek: '' },
    { donukOnek: 'x'.repeat(257) },
  ])('geçersiz ayarı reddeder: %j', (p) => {
    expect(ayarGecerli({ ...AYAR, ...p })).toBe(false);
    expect(() => ayarlariYaz({ ...AYAR, ...p })).toThrow(/geçersiz/);
  });
  it('aynı sütunları veya Excel sınırını aşan sütunu reddeder', () => {
    expect(ayarGecerli({ ...AYAR, d01: { ...AYAR.d01, kodSutunu: 'B' } })).toBe(false);
    expect(ayarGecerli({ ...AYAR, d01: { ...AYAR.d01, kodSutunu: 'XFD' } })).toBe(false);
  });
  it('bozuk yerel ayarı varsayılanla güvenli biçimde değiştirir', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ tolerans: -10 }) });
    expect(ayarlariOku()).toEqual(AYAR);
  });
  it('normal kısmi ayarları korur', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ tolerans: 0.002 }) });
    expect(ayarlariOku().tolerans).toBe(0.002);
  });
});

describe('CSV ve sayı güvenliği', () => {
  it.each(['=HYPERLINK("x")', '+1+2', '-2+3', '@SUM(A1)', '\t=1', '\r=1', '  =1'])(
    'metin hücresindeki formülü etkisizleştirir: %j',
    (metin) => {
      const k: GecmisKaydi = {
        zaman: '2026-10-02T06:00:00Z',
        rapor: 'Sentetik',
        dosya: metin,
        sayfa: '02.10',
        durum: 'Tamam',
        ledStogu: 1,
        depoSayimi: 2,
        gelenMal: 3,
        uyariSayisi: 0,
        aciklama: metin,
        kayit: 'indirildi',
      };
      const csv = gecmisCsv([k]);
      expect(csv).toContain(`"'${metin.replace(/"/g, '""')}"`);
    },
  );
  it('negatif miktarları formül koruması sırasında metne dönüştürmez', () => {
    const k: GecmisKaydi = {
      zaman: '2026-10-02T06:00:00Z',
      rapor: 'Sentetik',
      dosya: 'Sentetik.xlsx',
      sayfa: '02.10',
      durum: 'Tamam',
      ledStogu: -2.5,
      depoSayimi: 1,
      gelenMal: 0,
      uyariSayisi: 0,
      aciklama: '',
      kayit: 'indirildi',
    };
    const csv = gecmisCsv([k]);
    expect(csv).toContain('"-2,500"');
    expect(csv).not.toContain('"\'-2,500"');
  });
  it('metin olarak gelen taşmış sayı sonlu kalır', () => {
    expect(sayiCevir('9'.repeat(400))).toBe(0);
  });
});
