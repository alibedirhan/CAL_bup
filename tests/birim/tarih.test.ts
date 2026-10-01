import { describe, expect, it } from 'vitest';
import {
  dosyaAdiTarihi,
  gunAdi,
  ggAaYyyy,
  girilenTarih,
  gunSayfasiMi,
  sayfaAdi,
  sayfaTarihi,
  sayfaTarihiYilli,
  sonrakiGun,
  tarih,
  tarihBul,
  tarihDegistir,
  tarihMetni,
} from '../../src/cekirdek/tarih';

const BUGUN = tarih(2026, 10, 1);

describe('ggAaYyyy', () => {
  it.each([
    ['30.09.2026', tarih(2026, 9, 30)],
    ['1.10.26', tarih(2026, 10, 1)],
    ['31.02.2026', null],
    ['29.02.2028', tarih(2028, 2, 29)],
    ['30.09', null],
    ['abc', null],
    ['30.13.2026', null],
  ])('%s', (s, beklenen) => {
    expect(ggAaYyyy(s)).toBe(beklenen);
  });
});

describe('tarihBul', () => {
  const m = 'Başlangıç Tarihi : 01.01.2026\nBitiş Tarihi : 30.09.2026\n';

  it('etiketin ardındaki tarihi bulur', () => {
    expect(tarihBul(m, 'Bitiş Tarihi')).toBe(tarih(2026, 9, 30));
    expect(tarihBul(m, 'Başlangıç Tarihi')).toBe(tarih(2026, 1, 1));
    expect(tarihBul(m, 'Yok')).toBeNull();
    expect(tarihBul(null, 'Bitiş Tarihi')).toBeNull();
  });

  it('büyük harfli ve İ içeren başlıkta da bulur', () => {
    expect(tarihBul('DEPO KARTI : İZMİR\nBİTİŞ TARİHİ : 30.09.2026', 'Bitiş Tarihi')).toBe(
      tarih(2026, 9, 30),
    );
  });
});

describe('gün sayfası adları', () => {
  it.each([
    ['30.09', tarih(2026, 9, 30)],
    ['01.08 DEPO', tarih(2026, 8, 1)],
    ['31.07 DEPO KONTROLÜ', tarih(2026, 7, 31)],
    ['30.09x', null],
    ['Ana Sayfa', null],
  ])('%s', (ad, beklenen) => {
    expect(sayfaTarihi(ad, 2026)).toBe(beklenen);
  });

  it('yılı bugüne göre seçer', () => {
    expect(sayfaTarihiYilli('30.09', BUGUN)).toBe(tarih(2026, 9, 30));
    expect(sayfaTarihiYilli('30.12', tarih(2027, 1, 2))).toBe(tarih(2026, 12, 30)); // yıl dönümü
  });

  it('29 Şubat da gün sayfasıdır', () => {
    expect(gunSayfasiMi('29.02')).toBe(true);
    expect(gunSayfasiMi('Geçmiş')).toBe(false);
  });

  it('sayfa adı ve tarih metni', () => {
    expect(sayfaAdi(tarih(2026, 10, 1))).toBe('01.10');
    expect(tarihMetni(tarih(2026, 10, 1))).toBe('01.10.2026');
    expect(gunAdi(tarih(2026, 9, 30))).toBe('Çarşamba');
  });
});

describe('dosyaAdiTarihi', () => {
  it.each([
    ['SAYIM_30_09.xlsx', tarih(2026, 9, 30)],
    ['C:\\Rapor\\SAYIM_30_09 (1).xlsx', tarih(2026, 9, 30)], // Windows yolu, kopya eki
    ['/ev/ornekler/SAYIM_30_09.xlsx', tarih(2026, 9, 30)],
    ['Sayım 30.09.2026.XLSX', tarih(2026, 9, 30)], // yıl yazılmış
    ['Sayım 1-10.xlsx', tarih(2026, 10, 1)], // tek haneli gün, tire
    ['D01 SAYIM 30_09.xlsx', tarih(2026, 9, 30)], // "01 30" geçersiz, atlanır
    ['SAYIM.xlsx', null],
    ['SAYIM_2026.xlsx', null],
    ['SAYIM_31_02.xlsx', null],
  ])('%s', (yol, beklenen) => {
    expect(dosyaAdiTarihi(yol, BUGUN)).toBe(beklenen);
  });
});

describe('tarihDegistir', () => {
  it('baştaki tarihi değiştirir, gerisini korur', () => {
    expect(tarihDegistir('29.09.2026 LED DEPO STOĞU (D01)', tarih(2026, 9, 30))).toBe(
      '30.09.2026 LED DEPO STOĞU (D01)',
    );
  });

  it('tarih yoksa başa ekler', () => {
    expect(tarihDegistir('DEPO STOĞU', tarih(2026, 9, 30))).toBe('30.09.2026 DEPO STOĞU');
    expect(tarihDegistir(null, tarih(2026, 9, 30))).toBe('30.09.2026');
  });
});

describe('sonrakiGun', () => {
  it('pazarı atlar (ayar açıksa)', () => {
    const cumartesi = tarih(2026, 10, 3);
    expect(sonrakiGun(cumartesi, true)).toBe(tarih(2026, 10, 5));
    expect(sonrakiGun(cumartesi, false)).toBe(tarih(2026, 10, 4));
    expect(sonrakiGun(tarih(2026, 9, 30), true)).toBe(tarih(2026, 10, 1));
  });

  it('ay ve yıl sonunu geçer', () => {
    expect(sonrakiGun(tarih(2026, 12, 31), true)).toBe(tarih(2027, 1, 1));
  });
});

describe('girilenTarih', () => {
  const oneri = tarih(2026, 9, 30);

  it.each([
    ['30.09', tarih(2026, 9, 30)],
    ['1/10', tarih(2026, 10, 1)],
    ['01-10-2026', tarih(2026, 10, 1)],
    ['1,10', tarih(2026, 10, 1)],
    ['', null],
    ['32.09', null],
  ])('%s', (girdi, beklenen) => {
    expect(girilenTarih(girdi, oneri)).toBe(beklenen);
  });
});
