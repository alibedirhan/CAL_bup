import { describe, it, expect, vi, afterEach } from 'vitest';
import { basarisiz, tamam } from '../../src/cekirdek/islemSonucu';
import { cariFormunuDenetle, kartFormunuDenetle } from '../../src/cekirdek/posFormDenetimi';
import { yaz } from '../../src/platform/saklama';
import type { PosKart } from '../../src/cekirdek/posKart';
afterEach(() => vi.unstubAllGlobals());
describe('işlem sonucu ve alan doğrulama', () => {
  it('başarı ve belirsizlik metinden bağımsızdır; işlem bağlamı korunur', () => {
    const b = { kapsam: 'kart', islemId: 4 };
    expect(tamam(12, 'hazır', b)).toMatchObject({ ...b, durum: 'tamam', deger: 12 });
    expect(basarisiz('belirsiz', 'güncel kaydı kontrol edin', 'DEPO', b)).toMatchObject({
      ...b,
      durum: 'belirsiz',
      kod: 'DEPO',
    });
  });
  it('tüm eksik alanları tek seferde verir, telefon isteğe bağlı kalır', () => {
    const k = { ad: '', numara: '', sahibi: '', ay: '', yil: '', telefon: '' } as PosKart;
    expect(Object.keys(kartFormunuDenetle(k, false))).toEqual([
      'pos-kart-ad',
      'pos-kart-numara',
      'pos-kart-ay',
      'pos-kart-yil',
      'pos-kart-onay',
    ]);
    expect(Object.keys(cariFormunuDenetle({ id: '', ad: 'x', numara: '0' }, false))).toHaveLength(3);
  });
  it('kalıcı yazı başarısızsa başarı dönmez', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('yapay');
      },
    });
    expect(yaz('ayar', 'deger')).toBe(false);
  });
});
