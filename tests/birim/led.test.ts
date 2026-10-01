import { describe, expect, it } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR, sutunNo } from '../../src/cekirdek/ayarlar';
import { tarih } from '../../src/cekirdek/tarih';
import { OkumaHatasi } from '../../src/kaynaklar/kitap';
import { d01Oku, sayimOku, subeAlisOku } from '../../src/kaynaklar/led';
import { dosyaTuru } from '../../src/kaynaklar/tani';
import { d01Kitap, depoKontrolKitap, sayimKitap, subeKitap } from '../yardimci/sentetik';

const BUGUN = tarih(2026, 10, 1);

describe('D01 okuyucu', () => {
  const kv = d01Oku(d01Kitap(), AYAR);

  it('başlıktaki tarihleri okur', () => {
    expect(kv.tarih).toBe(tarih(2026, 9, 30));
    expect(kv.baslangicTarihi).toBe(tarih(2026, 1, 1));
  });

  it('aynı adı farklı kodlarla toplar ve boşlukları temizler', () => {
    expect(kv.miktar('ALFA ÜRÜN')).toBeCloseTo(1250.5);
    expect(kv.miktar('DON.GAMA DÖNER(20 KG)')).toBeCloseTo(108.68);
    expect(kv.miktar('zeta ürün')).toBe(5);
    expect(kv.adlar.get('ZETA ÜRÜN')).toBe('ZETA ÜRÜN');
  });

  it('ilk dip toplamı alır, arada boşluklu satırı atlar', () => {
    expect(kv.dipToplamVar).toBe(true);
    expect(kv.dipToplam).toBeCloseTo(kv.toplam(), 6);
  });
});

describe('sayım fişi okuyucu', () => {
  it('aynı ürünün satırlarını toplar', () => {
    const kv = sayimOku(sayimKitap(), AYAR, BUGUN);
    expect(kv.tarih).toBe(tarih(2026, 9, 30));
    expect(kv.miktar('ZETA ÜRÜN')).toBe(5.5);
    expect(kv.dipToplam).toBeCloseTo(kv.toplam(), 6);
  });

  it('tarihi önce dosya adından alır', () => {
    // Dosya 30.09'da oluşturulmuş ama adı 29.09 diyor: ad kazanır
    expect(sayimOku(sayimKitap('SAYIM_29_09.xlsx'), AYAR, BUGUN).tarih).toBe(tarih(2026, 9, 29));
    // Adda tarih yoksa oluşturma tarihi
    expect(sayimOku(sayimKitap('SAYIM.xlsx'), AYAR, BUGUN).tarih).toBe(tarih(2026, 9, 30));
    // Hiçbiri yoksa boş
    expect(sayimOku(sayimKitap('SAYIM.xlsx', null), AYAR, BUGUN).tarih).toBeNull();
  });

  it('dip toplam hesaplanmamışsa satırların toplamını kullanır', () => {
    const k = sayimKitap();
    const sayfa = k.sayfalar[0];
    if (!sayfa) throw new Error('sayfa yok');
    const hesaplanmamis = {
      ...k,
      sayfalar: [{ ...sayfa, hucre: (r: number, c: number) => (r === 7 ? null : sayfa.hucre(r, c)) }],
    };
    const kv = sayimOku(hesaplanmamis, AYAR, BUGUN);
    expect(kv.dipToplamVar).toBe(false);
    expect(kv.esasToplam()).toBeCloseTo(1274.5);
  });
});

describe('şube alış okuyucu', () => {
  it('"Stok İsim:" grup satırlarını atlar', () => {
    const kv = subeAlisOku(subeKitap(), AYAR);
    expect(kv.tarih).toBe(tarih(2026, 9, 29));
    expect([...kv.miktarlar.keys()]).toEqual(['ALFA ÜRÜN', 'BETA ÜRÜN']);
    expect(kv.dipToplam).toBeCloseTo(1015.32);
  });
});

describe('yanlış dosya', () => {
  it('anlaşılır bir hatayla reddedilir', () => {
    expect(() => d01Oku(sayimKitap(), AYAR)).toThrow(OkumaHatasi);
    expect(() => sayimOku(d01Kitap(), AYAR, BUGUN)).toThrow(/sayım fişi değil/);
    expect(() => subeAlisOku(d01Kitap(), AYAR)).toThrow(/Şube Alış raporu değil/);
  });
});

describe('dosya türünü tanıma', () => {
  it('her dosyayı içeriğinden tanır', () => {
    expect(dosyaTuru(d01Kitap(), AYAR)).toBe('d01');
    expect(dosyaTuru(sayimKitap(), AYAR)).toBe('sayim');
    expect(dosyaTuru(subeKitap(), AYAR)).toBe('subeAlis');
    expect(dosyaTuru(depoKontrolKitap(), AYAR)).toBe('depoKontrol');
    expect(dosyaTuru({ dosyaAdi: 'x.xlsx', olusturulma: null, sayfalar: [] }, AYAR)).toBeNull();
  });
});

describe('sutunNo', () => {
  it('sütun harfini sayıya çevirir', () => {
    expect(sutunNo('A')).toBe(1);
    expect(sutunNo('h')).toBe(8);
    expect(sutunNo('AA')).toBe(27);
    expect(() => sutunNo('1')).toThrow();
  });
});
