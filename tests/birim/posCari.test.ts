import { describe, expect, it } from 'vitest';
import {
  cariAdi,
  cariKaydet,
  numaraMaskesi,
  posCarileriBirlestir,
  posGirisBilgisi,
  posGirisKullanicisi,
  posGirisSifresi,
  posOzelSifre,
  posNumarasi,
  posVerisiDogrula,
  type PosCari,
} from '../../src/cekirdek/posCari';

// Bütün kayıtlar yapaydır; gerçek giriş bilgisi kullanılmaz.
const a: PosCari = { id: '11111111-1111-4111-8111-111111111111', ad: 'Deneme Cari A', numara: '0123456789' };
const b: PosCari = { id: '22222222-2222-4222-8222-222222222222', ad: 'Deneme Cari B', numara: '00000000001' };

describe('Sanal POS cari kuralları', () => {
  it('numarayı metin olarak korur; baştaki sıfırları kaybetmez', () => {
    expect(posNumarasi(a.numara)).toBe('0123456789');
    expect(posGirisSifresi(a.numara)).toBe('0189');
    expect(posGirisSifresi(b.numara)).toBe('0001');
    expect(numaraMaskesi(a.numara)).toBe('••••••6789');
  });
  it.each(['123', '012 3456789', '0123456789x', '012345678900', '=0123456789', '١٢٣٤٥٦٧٨٩٠'])(
    'geçersiz numarayı reddeder: %s',
    (n) => expect(() => posNumarasi(n)).toThrow(/numara/),
  );
  it('cari adındaki fazla boşlukları temizler', () => {
    expect(cariAdi('  Deneme   Cari A  ')).toBe(a.ad);
  });
  it.each(['x', ' ', 'a'.repeat(121), 'Deneme\u202eCari', 'Deneme\u0000Cari'])(
    'geçersiz veya yanıltıcı cari adını reddeder',
    (ad) => expect(() => cariAdi(ad)).toThrow(/Cari adı/),
  );
  it('aynı numaraya ikinci kayıt açmaz', () => {
    expect(() => cariKaydet([a], { ...b, numara: a.numara })).toThrow(/zaten kayıtlı/);
  });
  it('Türkçe harfler ve boşluklarla aynı ada ikinci kayıt açmaz', () => {
    expect(() => cariKaydet([{ ...a, ad: 'İZMİR DENEME' }], { ...b, ad: ' izmir  deneme ' })).toThrow(
      /adı zaten/,
    );
  });
  it('düzenlemede kendi kaydını değiştirir; özgün listeyi değiştirmez', () => {
    const mevcut = [a, b];
    const sonuc = cariKaydet(mevcut, { ...a, ad: 'Yeni Deneme Cari' });
    expect(sonuc).toHaveLength(2);
    expect(sonuc.find((c) => c.id === a.id)?.ad).toBe('Yeni Deneme Cari');
    expect(mevcut[0]).toEqual(a);
  });
  it('bilinmeyen alanları kabul etmez; kart ve şifre kayda giremez', () => {
    for (const fazladan of [{ sifre: 'sır' }, { cvv: 'sır' }, { kart: 'sır' }, { foto: 'sır' }]) {
      expect(() => posVerisiDogrula({ surum: 1, cariler: [{ ...a, ...fazladan }] })).toThrow(/geçersiz/);
    }
    expect(() => posVerisiDogrula({ surum: 1, cariler: [a], parola: 'sır' })).toThrow(/geçersiz/);
  });
  it('bozuk sürüm, kimlik, sayısal numara ve tekrar eden kimliği reddeder', () => {
    for (const veri of [
      null,
      { surum: 2, cariler: [] },
      { surum: 1, cariler: [{ ...a, numara: 123 }] },
      { surum: 1, cariler: [a, { ...b, id: a.id }] },
      { surum: 1, cariler: [{ ...a, id: '-'.repeat(36) }] },
    ]) {
      expect(() => posVerisiDogrula(veri)).toThrow();
    }
  });
  it('yedek aktarımında aynı kayıt atlanır ve farklı cari eklenir', () => {
    expect(posCarileriBirlestir([a], [{ ...a, id: b.id }, b])).toHaveLength(2);
  });
  it('yedekteki numara veya ad çelişkisinde mevcut listeyi korur', () => {
    const mevcut = [a];
    expect(() => posCarileriBirlestir(mevcut, [{ ...b, numara: a.numara }])).toThrow(/çelişen/);
    expect(() => posCarileriBirlestir(mevcut, [{ ...b, ad: a.ad }])).toThrow(/adı zaten/);
    expect(mevcut).toEqual([a]);
  });
  it('liste boyutunu sınırlar', () => {
    expect(() => posVerisiDogrula({ surum: 1, cariler: Array.from({ length: 501 }, () => a) })).toThrow(
      /geçersiz/,
    );
  });
});

describe('POS giriş bilgisi', () => {
  it('varsayılan kural: lisans no = numara, şifre = ilk 2 + son 2 hane', () => {
    expect(posGirisBilgisi(a)).toEqual({
      vergiNo: a.numara,
      kullanici: a.numara,
      sifre: '0189',
      ozel: false,
    });
  });
  it('cariye özel lisans numarası ve şifre kuralın yerine geçer; geçersiz yazım reddedilir', () => {
    expect(posGirisBilgisi({ ...a, girisKullanici: 'L77' })).toMatchObject({
      kullanici: 'L77',
      sifre: '0189',
      ozel: true,
    });
    expect(posGirisBilgisi({ ...a, girisSifresi: 'Yapay 1' })).toMatchObject({
      kullanici: a.numara,
      sifre: 'Yapay 1',
    });
    expect(() => posGirisKullanicisi('L 77')).toThrow(/lisans/);
    expect(() => posOzelSifre(' boşluk')).toThrow(/şifre/i);
    expect(() => posOzelSifre('a'.repeat(65))).toThrow(/şifre/i);
    expect(() => posOzelSifre('gizli‮')).toThrow(/şifre/i);
  });
  it('özel giriş alanları şemaya girer, boş değer ve başka sır alanı girmez', () => {
    expect(
      posVerisiDogrula({ surum: 1, cariler: [{ ...a, girisKullanici: 'L77', girisSifresi: 'x' }] })
        .cariler[0],
    ).toEqual({
      ...a,
      girisKullanici: 'L77',
      girisSifresi: 'x',
    });
    expect(() => posVerisiDogrula({ surum: 1, cariler: [{ ...a, girisKullanici: '' }] })).toThrow(/geçersiz/);
  });
});
