import { describe, expect, it } from 'vitest';
import { VARSAYILAN_AYARLAR as AYAR } from '../../src/cekirdek/ayarlar';
import { girilenTarih, tarih } from '../../src/cekirdek/tarih';
import ExcelJS from 'exceljs';
import { sayfaGorunumu } from '../../src/kaynaklar/excel';
import { miktarDogrula, yuvarla3 } from '../../src/cekirdek/sayi';
import { subeAlisOku } from '../../src/kaynaklar/led';
import { KaynakVeri } from '../../src/cekirdek/kaynakVeri';
import { profilCariKaydet, type PosProfilVerisi } from '../../src/cekirdek/posProfil';
import { d01Oku, sayimOku } from '../../src/kaynaklar/led';
import { dosyaTuru } from '../../src/kaynaklar/tani';
import { formulKaydir } from '../../src/hedef/formul';
import { gunSayfalari, gunSec } from '../../src/raporlar/depoKontrol/gunSecimi';
import { gecmisBirlestir } from '../../src/platform/driveEsitleme';
import type { GecmisKaydi } from '../../src/cekirdek/gecmis';
import { d01Kitap, sayimKitap } from '../yardimci/sentetik';

const BUGUN = tarih(2026, 10, 4);
describe('genel tarama: yanlış rapor ve tarih koruması', () => {
  it.each(['30.09.20260', '30.09.2026.01', '30.09.2026xyz', '30.09.2'])(
    'eksik/fazla tarih parçasını kabul etmez: %s',
    (girdi) => {
      expect(girilenTarih(girdi, BUGUN)).toBeNull();
    },
  );
  it('aynı günü gösteren iki sayfadan birini sessizce seçmez', () => {
    expect(() => gunSayfalari(['28.09', '29.09', '29.09 DEPO'], BUGUN)).toThrow(/aynı gün/i);
  });
  it('sekme sırası kronolojik değilse yanlış önceki güne bağlamaz', () => {
    expect(() => gunSayfalari(['29.09', '28.09'], BUGUN)).toThrow(/sıra/i);
  });
  it('başka yıldaki aynı gün/ay sayfasının üzerine yazmaz', () => {
    const gunler = gunSayfalari(['28.09', '29.09'], BUGUN);
    expect(() => gunSec(gunler, tarih(2027, 9, 29))).toThrow(/yıl/i);
  });
  it.each(['#VALUE!', '10 kg', '12,3,4', '12.34', '9'.repeat(400), true])(
    'bozuk miktarı sıfır/kısmi sayı saymaz: %s',
    (v) => {
      const k = d01Kitap(),
        s = k.sayfalar[0];
      if (!s) throw new Error('Yapay sayfa eksik');
      expect(() =>
        d01Oku(
          { ...k, sayfalar: [{ ...s, hucre: (r, c) => (r === 4 && c === 8 ? v : s.hucre(r, c)) }] },
          AYAR,
        ),
      ).toThrow(/miktar/i);
    },
  );
  it('aynı üründe sayısal taşmayı durdurur', () => {
    const k = new KaynakVeri('Yapay');
    k.ekle('Yapay ürün', 1e308);
    expect(() => k.ekle('Yapay ürün', 1e308)).toThrow(/miktar/i);
  });
  it('farklı ürünlerin toplamındaki taşmayı durdurur', () => {
    const k = new KaynakVeri('Yapay');
    k.ekle('Yapay A', 1e308);
    k.ekle('Yapay B', 1e308);
    expect(() => k.toplam()).toThrow(/miktar/i);
  });
  it('birden fazla rapor türüne uyan kitabı otomatik seçmez', () => {
    expect(() =>
      dosyaTuru({ ...d01Kitap(), sayfalar: [...d01Kitap().sayfalar, ...sayimKitap().sayfalar] }, AYAR),
    ).toThrow(/birden fazla/i);
  });
  it('ayarların izin verdiği 33. sütundaki birimi de kontrol eder', () => {
    const k = sayimKitap(),
      s = k.sayfalar[0];
    if (!s) throw new Error('Yapay sayfa eksik');
    expect(() =>
      sayimOku(
        {
          ...k,
          sayfalar: [
            {
              ...s,
              hucre: (r, c) =>
                c === 33
                  ? r === AYAR.sayim.ilkVeriSatiri - 1
                    ? 'Birim'
                    : 'ADET'
                  : s.hucre(r, c) === 'Birim'
                    ? null
                    : s.hucre(r, c),
            },
          ],
        },
        AYAR,
        BUGUN,
      ),
    ).toThrow(/kilogram/);
  });
  it('başka sayfanın aralık sonunu ve tablo sütun adını kaydırmaz', () => {
    expect(
      formulKaydir("SUM('Önceki gün'!B4:B211)+SUM(Sayfa1!$D$4:$D$211)+SUM(B4:B211)+Tablo1[A211]", 106),
    ).toBe("SUM('Önceki gün'!B4:B211)+SUM(Sayfa1!$D$4:$D$211)+SUM(B4:B212)+Tablo1[A211]");
  });
});
describe('genel tarama: kartın cari bağı ve geçmiş', () => {
  it('kartı olan carinin numarasını değiştirerek kartları farklı kişiye bağlamaz', () => {
    const cari = { id: '11111111-1111-4111-8111-111111111111', ad: 'Yapay Cari', numara: '0123456789' };
    const v: PosProfilVerisi = {
      surum: 2,
      cariler: [cari],
      kartlar: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          cariId: cari.id,
          ad: 'Yapay Kart',
          numara: '4242424242424242',
          sahibi: '',
          telefon: '',
          ay: '12',
          yil: '2035',
          onayTarihi: '2026-10-04T00:00:00.000Z',
        },
      ],
    };
    expect(() => profilCariKaydet(v, { ...cari, numara: '9876543210' })).toThrow(/kart/i);
    expect(profilCariKaydet(v, { ...cari, ad: 'Yapay Yeni Ad' }).kartlar).toEqual(v.kartlar);
    expect(
      profilCariKaydet({ ...v, kartlar: [] }, { ...cari, numara: '9876543210' }).cariler[0]?.numara,
    ).toBe('9876543210');
  });
  it('geçmiş sıralamasını saat dilimi metni yerine gerçek zamana göre yapar', () => {
    const k: GecmisKaydi = {
      zaman: '2026-10-04T09:00:00Z',
      rapor: 'Yapay',
      dosya: 'Yapay.xlsx',
      sayfa: '04.10',
      durum: 'Tamam',
      ledStogu: 1,
      depoSayimi: 1,
      gelenMal: 1,
      uyariSayisi: 0,
      aciklama: '',
      kayit: 'indirildi',
    };
    const ayni = { ...k, zaman: '2026-10-04T12:00:00+03:00' };
    const dahaEski = { ...k, zaman: '2026-10-04T11:30:00+03:00' };
    expect(gecmisBirlestir([k], [ayni, dahaEski])).toHaveLength(2);
    expect(Date.parse(gecmisBirlestir([k], [dahaEski])[0]?.zaman ?? '')).toBe(Date.parse(k.zaman));
  });
});

describe('LED yapısı ve miktar sınırları', () => {
  it.each([
    ['1.234,500', 1234.5],
    [' -12,25 ', -12.25],
    ['', 0],
    [null, 0],
    [',5', 0.5],
  ])('geçerli miktar korunur: %s', (v, n) => expect(miktarDogrula(v)).toBe(n));
  it.each([Infinity, -Infinity, NaN])('hesap taşması rapora yazılmaz: %s', (v) =>
    expect(() => yuvarla3(v)).toThrow(/miktar/),
  );
  it('birleşik LED grup başlığı bozuk ürün miktarı sanılmaz', () => {
    const w = new ExcelJS.Workbook(),
      s = w.addWorksheet('Sheet');
    s.getCell('A1').value = AYAR.subeAlis.tanim;
    s.mergeCells('A4:I4');
    s.getCell('A4').value = 'Yapay grup başlığı';
    s.getCell('D5').value = 'Yapay ürün';
    s.getCell('F5').value = 'Y01';
    s.getCell('H5').value = '12,500';
    const k = { dosyaAdi: 'Yapay.xlsx', olusturulma: null, sayfalar: [sayfaGorunumu(s)] };
    expect(subeAlisOku(k, AYAR).toplam()).toBe(12.5);
    s.unMergeCells('A4:I4');
    s.getCell('D4').value = 'Yapay bozuk ürün';
    s.getCell('H4').value = '12 kg';
    expect(() => subeAlisOku({ ...k, sayfalar: [sayfaGorunumu(s)] }, AYAR)).toThrow(/miktar/);
  });
  it.each([false, true])(
    'hesaplanmamış üründe durur; dip toplam yoksa satır toplamını kullanır: %s',
    (dip) => {
      const w = new ExcelJS.Workbook(),
        s = w.addWorksheet('Sheet');
      s.getCell('A1').value = AYAR.d01.tanim;
      s.getCell('A4').value = 'Y01';
      s.getCell('B4').value = 'Yapay ürün';
      s.getCell('H4').value = dip ? 1 : { formula: '1+1' };
      if (dip) s.getCell('H5').value = { formula: 'SUM(H4:H4)' };
      const oku = () =>
        d01Oku({ dosyaAdi: 'Yapay.xlsx', olusturulma: null, sayfalar: [sayfaGorunumu(s)] }, AYAR);
      if (dip) expect(oku().esasToplam()).toBe(1);
      else expect(oku).toThrow(/hesaplanmış/);
    },
  );
});
