import { describe, expect, it } from 'vitest';
import { ozetImzasi, profilBirlestir, profilBirlestirmeOzeti } from '../../src/cekirdek/posBirlestirme';
import type { PosKart } from '../../src/cekirdek/posKart';
import { posProfilDogrula, type PosProfilVerisi } from '../../src/cekirdek/posProfil';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const K1 = '33333333-3333-4333-8333-333333333333';
const K2 = '44444444-4444-4444-8444-444444444444';
const cari = (id: string, ad: string, numara: string) => ({ id, ad, numara });
const kart = (id: string, cariId: string, ek: Partial<PosKart> = {}): PosKart => ({
  id,
  cariId,
  ad: 'Yapay kart',
  numara: '4242424242424242',
  sahibi: '',
  ay: '12',
  yil: '2035',
  telefon: '',
  onayTarihi: '2026-10-05T10:00:00.000Z',
  ...ek,
});
const mevcut: PosProfilVerisi = {
  surum: 2,
  cariler: [cari(A, 'Yapay Cari', '0123456789')],
  kartlar: [kart(K1, A)],
};
let sayac = 0;
const kimlik = () => `00000000-0000-4000-8000-${String(++sayac).padStart(12, '0')}`;

describe('Yedekten ekleme ve iki bilgisayarda düzenlenmiş kayıtlar', () => {
  it('tam aynı yedek hiçbir şeyi çoğaltmaz', () => {
    expect(profilBirlestirmeOzeti(mevcut, mevcut)).toEqual({
      yeniCari: 0,
      yeniKart: 0,
      ayniCari: 1,
      ayniKart: 1,
      catismalar: [],
    });
    expect(profilBirlestir(mevcut, mevcut, 'koru')).toEqual(mevcut);
  });
  it('cari adı farklıysa çatışma gösterilir; seçime göre korunur veya yedektekiyle değişir', () => {
    const gelen = { ...mevcut, cariler: [cari(A, 'Yapay Cari Ltd', '0123456789')] };
    const ozet = profilBirlestirmeOzeti(mevcut, gelen);
    expect(ozet.catismalar).toEqual([
      { tur: 'cari', metin: expect.stringContaining('burada “Yapay Cari”, yedekte “Yapay Cari Ltd”') },
    ]);
    expect(ozet.catismalar[0]?.metin).not.toContain('0123456789');
    expect(profilBirlestir(mevcut, gelen, 'koru').cariler[0]?.ad).toBe('Yapay Cari');
    expect(profilBirlestir(mevcut, gelen, 'yedek').cariler[0]?.ad).toBe('Yapay Cari Ltd');
  });
  it('kartın telefonu/adı farklıysa farklı alanlar listelenir; numara gösterilmez', () => {
    const gelen = { ...mevcut, kartlar: [kart(K1, A, { telefon: '+905000000000', ad: 'Şirket kartı' })] };
    const ozet = profilBirlestirmeOzeti(mevcut, gelen);
    expect(ozet.catismalar).toHaveLength(1);
    expect(ozet.catismalar[0]?.metin).toContain('farklı kart adı, telefon');
    expect(ozet.catismalar[0]?.metin).not.toContain('4242424242424242');
    expect(profilBirlestir(mevcut, gelen, 'koru')).toEqual(mevcut);
    const v = profilBirlestir(mevcut, gelen, 'yedek');
    expect(v.kartlar).toEqual([kart(K1, A, { telefon: '+905000000000', ad: 'Şirket kartı' })]);
  });
  it('başka bilgisayarda ayrı oluşturulmuş aynı cari ve kart tek kayda bağlanır', () => {
    const gelen: PosProfilVerisi = {
      surum: 2,
      cariler: [cari(B, 'Yapay Cari', '0123456789')],
      kartlar: [kart(K2, B)],
    };
    expect(profilBirlestir(mevcut, gelen, 'koru')).toEqual(mevcut);
  });
  it('yeni cari/kart eklenir; kimlik çakışırsa yeni kimlik verilir, mevcut kayıt ezilmez', () => {
    const gelen: PosProfilVerisi = {
      surum: 2,
      cariler: [cari(A, 'Öteki Yapay Cari', '00000000001')],
      kartlar: [kart(K1, A, { numara: '5555555555554444' })],
    };
    const v = profilBirlestir(mevcut, gelen, 'koru', undefined, kimlik);
    expect(v.cariler).toHaveLength(2);
    expect(v.kartlar).toHaveLength(2);
    const yeniCari = v.cariler.find((c) => c.numara === '00000000001');
    expect(yeniCari?.id).not.toBe(A);
    expect(v.kartlar.find((k) => k.numara === '5555555555554444')).toMatchObject({ cariId: yeniCari?.id });
    expect(v.kartlar.find((k) => k.numara === '4242424242424242')).toEqual(mevcut.kartlar[0]);
  });
  it('aynı ad farklı numarada çözülemeyen durum adıyla ve maskeli numarayla bildirilir', () => {
    const gelen = { surum: 2 as const, cariler: [cari(B, 'yapay cari', '00000000001')], kartlar: [] };
    expect(() => profilBirlestirmeOzeti(mevcut, gelen)).toThrow(/“yapay cari” adı burada •+6789/);
  });
  it('yedekteki yeni ad başka carinin adıysa “yedektekini kullan” durur', () => {
    const iki: PosProfilVerisi = {
      ...mevcut,
      cariler: [...mevcut.cariler, cari(B, 'Öteki Yapay Cari', '00000000001')],
    };
    const gelen = { ...mevcut, cariler: [cari(A, 'Öteki Yapay Cari', '0123456789')], kartlar: [] };
    expect(profilBirlestir(iki, gelen, 'koru')).toEqual(posProfilDogrula(iki));
    expect(() => profilBirlestir(iki, gelen, 'yedek')).toThrow(/başka bir caride/);
  });
  it('onaylanan özet değiştiyse hiçbir şey birleştirilmez', () => {
    const gelen = { ...mevcut, kartlar: [kart(K1, A, { telefon: '+905000000000' })] };
    const imza = ozetImzasi(profilBirlestirmeOzeti(mevcut, gelen));
    expect(() => profilBirlestir(mevcut, gelen, 'yedek', imza)).not.toThrow();
    const degisen = { ...mevcut, kartlar: [kart(K1, A, { telefon: '+905000000000' })] };
    expect(() => profilBirlestir(degisen, gelen, 'yedek', imza)).toThrow(/yeniden inceleyin/);
  });
  it('cari ve kart birlikte farklıyken özet iki seçimde de aynıdır', () => {
    const gelen: PosProfilVerisi = {
      surum: 2,
      cariler: [cari(A, 'Yapay Cari Ltd', '0123456789')],
      kartlar: [kart(K1, A, { telefon: '+905000000000' })],
    };
    const imza = ozetImzasi(profilBirlestirmeOzeti(mevcut, gelen));
    expect(profilBirlestir(mevcut, gelen, 'koru', imza)).toEqual(mevcut);
    const v = profilBirlestir(mevcut, gelen, 'yedek', imza);
    expect(v.cariler[0]?.ad).toBe('Yapay Cari Ltd');
    expect(v.kartlar[0]?.telefon).toBe('+905000000000');
  });
  it('cari başına 10 kart sınırı birleştirmede de korunur', () => {
    const numaralar = Array.from({ length: 11 }, (_, i) => {
      const temel = String(400000000000000 + i);
      for (let son = 0; son < 10; son++) {
        const n = temel + son;
        let t = 0;
        for (let j = n.length - 1, iki = false; j >= 0; j--, iki = !iki) {
          let d = Number(n[j]);
          if (iki) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
          t += d;
        }
        if (t % 10 === 0) return n;
      }
      throw new Error('Yapay numara üretilemedi');
    });
    const on = numaralar.slice(0, 10).map((numara, i) => kart(kimlik(), A, { numara, ad: 'Kart ' + i }));
    const dolu = { ...mevcut, kartlar: on };
    const gelen = { ...mevcut, kartlar: [kart(K2, A, { numara: numaralar[10] ?? '' })] };
    expect(() => profilBirlestir(dolu, gelen, 'koru')).toThrow(/10 kart sınırı/);
  });
});

describe('Cariye özel POS girişi yedekte', () => {
  it('giriş bilgisi farklıysa çatışma gösterilir; şifre metni özete girmez', () => {
    const gelen = {
      ...mevcut,
      cariler: [{ ...cari(A, 'Yapay Cari', '0123456789'), girisKullanici: 'L77', girisSifresi: 'yapay-sir' }],
    };
    const ozet = profilBirlestirmeOzeti(mevcut, gelen);
    expect(ozet.catismalar).toHaveLength(1);
    expect(ozet.catismalar[0]?.metin).toContain('farklı POS giriş bilgisi');
    expect(JSON.stringify(ozet)).not.toContain('yapay-sir');
    expect(profilBirlestir(mevcut, gelen, 'koru').cariler[0]).toEqual(mevcut.cariler[0]);
    expect(profilBirlestir(mevcut, gelen, 'yedek').cariler[0]).toMatchObject({ girisKullanici: 'L77' });
    expect(profilBirlestir(gelen, mevcut, 'yedek').cariler[0]).toEqual(mevcut.cariler[0]);
  });
});
