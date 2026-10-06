import { describe, expect, it } from 'vitest';
import { KullaniciHatasi } from '../../src/cekirdek/hata';
import { tarih } from '../../src/cekirdek/tarih';
import {
  atlananGunler,
  atlananGunMetni,
  gunSayfalari,
  gunSec,
  tarihOnerisi,
} from '../../src/raporlar/depoKontrol/gunSecimi';

const BUGUN = tarih(2026, 10, 1);
const GUNLER = gunSayfalari(['Ana Sayfa', '26.09', '28.09 DEPO', '29.09', 'Geçmiş'], BUGUN);

describe('gün seçimi', () => {
  it('gün sayfalarını sırasıyla bulur', () => {
    expect(GUNLER.map((g) => g.ad)).toEqual(['26.09', '28.09 DEPO', '29.09']);
  });

  it('son sayfadan sonraki iş gününü önerir', () => {
    expect(tarihOnerisi(GUNLER, true)).toBe(tarih(2026, 9, 30));
    const cumartesi = gunSayfalari(['03.10'], BUGUN);
    expect(tarihOnerisi(cumartesi, true)).toBe(tarih(2026, 10, 5));
    expect(tarihOnerisi(cumartesi, false)).toBe(tarih(2026, 10, 4));
  });

  it('yeni gün son sayfadan kopyalanır', () => {
    expect(gunSec(GUNLER, tarih(2026, 9, 30))).toEqual({
      tur: 'yeni',
      tarih: tarih(2026, 9, 30),
      ad: '30.09',
      onceki: { ad: '29.09', tarih: tarih(2026, 9, 29) },
    });
  });

  it('var olan gün kendinden önceki sayfayla yeniden doldurulur', () => {
    const s = gunSec(GUNLER, tarih(2026, 9, 28));
    expect(s).toMatchObject({ tur: 'mevcut', ad: '28.09 DEPO', onceki: { ad: '26.09' } });
  });

  it('son sayfadan önceki, olmayan bir gün reddedilir', () => {
    expect(() => gunSec(GUNLER, tarih(2026, 9, 27))).toThrow(KullaniciHatasi);
    expect(() => gunSec(GUNLER, tarih(2026, 9, 26))).toThrow(/önce gelen bir gün sayfası yok/);
  });

  it('gün sayfası yoksa anlaşılır hata', () => {
    expect(() => tarihOnerisi([], true)).toThrow(/gün sayfası bulunamadı/);
  });
});

describe('atlanan günler', () => {
  it('ertesi iş günü seçilince boştur; pazar ayara göre sayılır', () => {
    expect(atlananGunler(tarih(2026, 9, 29), tarih(2026, 9, 30), true)).toEqual([]);
    // 03.10 cumartesi → 05.10 pazartesi
    expect(atlananGunler(tarih(2026, 10, 3), tarih(2026, 10, 5), true)).toEqual([]);
    expect(atlananGunler(tarih(2026, 10, 3), tarih(2026, 10, 5), false)).toEqual([tarih(2026, 10, 4)]);
  });

  it('arada sayfası olmayan iş günlerini sırayla verir', () => {
    expect(atlananGunler(tarih(2026, 10, 1), tarih(2026, 10, 3), true)).toEqual([tarih(2026, 10, 2)]);
    const uzun = atlananGunler(tarih(2026, 10, 1), tarih(2026, 10, 10), true);
    expect(uzun).toHaveLength(7);
    expect(atlananGunMetni(uzun)).toBe('7 iş günü (02.10.2026 – 09.10.2026)');
    expect(atlananGunMetni([tarih(2026, 10, 2)])).toBe('02.10.2026');
    expect(atlananGunMetni([])).toBe('');
  });

  it('çok uzun boşluk sınırlı sayıda gün üretir', () => {
    expect(atlananGunler(tarih(2020, 1, 1), tarih(2026, 1, 1), false)).toHaveLength(400);
  });
});
