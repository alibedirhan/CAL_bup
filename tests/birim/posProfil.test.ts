import { describe, expect, it } from 'vitest';
import {
  kartNumarasi,
  kartTelefonu,
  kartSuresiGecti,
  kartMaskesi,
  type PosKart,
} from '../../src/cekirdek/posKart';
import {
  posProfilDogrula,
  profilCariKaydet,
  profilCariSil,
  profilKartKaydet,
  profilKartSil,
  type PosProfilVerisi,
} from '../../src/cekirdek/posProfil';
import { kartGoruntuBoyutu, kartMetnindenAlanlar } from '../../src/cekirdek/posKartFotografi';

const a = { id: '11111111-1111-4111-8111-111111111111', ad: 'Yapay Cari A', numara: '0123456789' };
const b = { id: '22222222-2222-4222-8222-222222222222', ad: 'Yapay Cari B', numara: '00000000001' };
const kart: PosKart = {
  id: '33333333-3333-4333-8333-333333333333',
  cariId: a.id,
  ad: 'Yapay Kart',
  numara: '4242424242424242',
  sahibi: 'Örnek Sahip',
  ay: '12',
  yil: '2035',
  telefon: '+905000000000',
  onayTarihi: '2026-10-03T00:00:00.000Z',
};
const veri: PosProfilVerisi = { surum: 2, cariler: [a, b], kartlar: [kart] };
const simdi = new Date(2026, 9, 3);

describe('Cari profili ve kart kuralları', () => {
  it('numarayı metin olarak korur; yalnızca son dört rakamı gösterir', () => {
    expect(kartNumarasi('4242 4242 4242 4242')).toBe(kart.numara);
    expect(kartMaskesi(kart)).toBe('•••• •••• •••• 4242');
  });
  it.each([
    '4242424242424241',
    '0000000000000000',
    '１２３４５６７８９０１２',
    '4242-4242-4242-4242',
    '1234',
    '1'.repeat(41),
  ])('geçersiz kartı reddeder: %s', (n) => {
    expect(() => kartNumarasi(n)).toThrow();
  });
  it.each(['0500 000 00 00', '5000000000', '+90 (500) 000-00-00'])(
    'telefonu standart biçime getirir: %s',
    (n) => {
      expect(kartTelefonu(n)).toBe('+905000000000');
    },
  );
  it('isteğe bağlı telefonu kabul eder; yabancı/bozuk numarayı sessiz kırpmaz', () => {
    expect(kartTelefonu(' ')).toBe('');
    for (const n of ['+15555555555', '+90+5000000000', '0500000', 'a'.repeat(30)])
      expect(() => kartTelefonu(n)).toThrow();
  });
  it('içinde bulunulan ay geçerlidir; geçmiş kartlar depoda okunabilir ama kaydedilemez', () => {
    expect(kartSuresiGecti({ ay: '10', yil: '2026' }, simdi)).toBe(false);
    expect(kartSuresiGecti({ ay: '09', yil: '2026' }, simdi)).toBe(true);
    expect(posProfilDogrula({ ...veri, kartlar: [{ ...kart, yil: '2025' }] }).kartlar).toHaveLength(1);
    expect(() => profilKartKaydet(veri, { ...kart, yil: '2025' }, simdi)).toThrow(/geçmiş/);
  });
  it('aynı caride aynı numarayı ikinci kez ve başka cariye kimlikle taşımayı reddeder', () => {
    expect(() => profilKartKaydet(veri, { ...kart, id: b.id }, simdi)).toThrow(/zaten/);
    expect(() => profilKartKaydet(veri, { ...kart, cariId: b.id }, simdi)).toThrow(/taşınamaz/);
  });
  it('kartı açıkça başka cari altında ayrı kayıt olarak ekleyebilir; yanlış cariden silmez', () => {
    const v = profilKartKaydet(veri, { ...kart, id: b.id, cariId: b.id }, simdi);
    expect(profilKartSil(v, b.id, kart.id).kartlar).toHaveLength(2);
    expect(profilCariSil(v, a.id).kartlar).toEqual([expect.objectContaining({ cariId: b.id })]);
  });
  it('CVV isteğe bağlıdır: kayıtlı CVV korunur, eski CVV’siz kayıt okunur, boş CVV alanı yazılmaz', () => {
    const v = profilKartKaydet(veri, { ...kart, cvv: '0123' }, simdi);
    expect(v.kartlar[0]?.cvv).toBe('0123');
    expect(posProfilDogrula(v)).toEqual(v);
    expect(posProfilDogrula(veri).kartlar[0]).not.toHaveProperty('cvv');
    expect(profilKartKaydet(v, { ...kart, cvv: '' }, simdi).kartlar[0]).not.toHaveProperty('cvv');
    for (const cvv of ['12', '12345', '12a', '١٢٣'])
      expect(() => profilKartKaydet(veri, { ...kart, cvv }, simdi)).toThrow(/CVV/);
    expect(() => posProfilDogrula({ ...veri, kartlar: [{ ...kart, cvv: '' }] })).toThrow();
  });
  it('başka sekmede değişen veya silinen kaydı açık formdan sessizce ezmez', () => {
    const duzenlenen = { ...kart, ad: 'Yeni Ad' };
    expect(profilKartKaydet(veri, duzenlenen, simdi, kart).kartlar[0]?.ad).toBe('Yeni Ad');
    const baskaSekme = profilKartKaydet(veri, { ...kart, telefon: '' }, simdi);
    expect(() => profilKartKaydet(baskaSekme, duzenlenen, simdi, kart)).toThrow(/başka sekmede/);
    expect(() => profilKartKaydet(profilKartSil(veri, a.id, kart.id), duzenlenen, simdi, kart)).toThrow(
      /başka sekmede/,
    );
    // Yeni kart formu açıkken aynı kimlik başka yerde oluşmuşsa yeni kayıt sayılmaz.
    expect(() => profilKartKaydet(veri, duzenlenen, simdi, null)).toThrow(/başka sekmede/);
    expect(() =>
      profilKartKaydet(profilCariSil(veri, b.id), { ...kart, id: b.id, cariId: b.id }, simdi, null),
    ).toThrow(/carisi başka sekmede silinmiş/);
    expect(profilCariKaydet(veri, { ...a, ad: 'Yapay Cari A2' }, a).cariler.map((c) => c.ad)).toContain(
      'Yapay Cari A2',
    );
    const adiDegismis = profilCariKaydet(veri, { ...a, ad: 'Başka Sekme Adı' });
    expect(() => profilCariKaydet(adiDegismis, { ...a, ad: 'Yapay Cari A2' }, a)).toThrow(/başka sekmede/);
    expect(() => profilCariKaydet(profilCariSil(veri, a.id), { ...a, ad: 'Yapay Cari A2' }, a)).toThrow(
      /başka sekmede/,
    );
  });
  it('olmayan cari ve tekrar eden kart kimliği kabul edilmez', () => {
    expect(() => posProfilDogrula({ ...veri, kartlar: [{ ...kart, cariId: kart.id }] })).toThrow();
    expect(() => posProfilDogrula({ ...veri, kartlar: [kart, kart] })).toThrow();
  });
  it.each(['cvv', 'otp', 'foto', 'hamOcr', 'tutar'])('yasak alanı şema reddeder: %s', (alan) => {
    expect(() => posProfilDogrula({ ...veri, [alan]: 'yapay' })).toThrow();
    expect(() => posProfilDogrula({ ...veri, kartlar: [{ ...kart, [alan]: 'yapay' }] })).toThrow();
  });
  it('on birinci kartı reddeder; aynı numarayı farklı carilerle karıştırmaz', () => {
    const kartlar = Array.from({ length: 11 }, (_, i) => {
      const temel = String(400000000000000 + i);
      const numara = Array.from({ length: 10 }, (_, son) => temel + son).find((n) => {
        try {
          kartNumarasi(n);
          return true;
        } catch {
          return false;
        }
      });
      if (!numara) throw new Error('Yapay numara üretilemedi');
      return { ...kart, numara, id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` };
    });
    const on = posProfilDogrula({ ...veri, kartlar: kartlar.slice(0, 10) });
    const onBirinci = kartlar[10];
    if (!onBirinci) throw new Error('Yapay kart eksik');
    expect(() => profilKartKaydet(on, onBirinci, simdi)).toThrow(/en fazla 10/);
    expect(() => posProfilDogrula({ ...veri, kartlar })).toThrow();
  });
});
describe('Yerel fotoğraf alanları ve boyut sınırı', () => {
  it('yalnızca numara/tarih adayını döndürür; ad, telefon ve üç rakamlık metin çıkmaz', () => {
    expect(kartMetnindenAlanlar('ÖRNEK SAHİP\n4242 4242 4242 4242\n12/35\n123\n05000000000')).toEqual({
      numaralar: [kart.numara],
      tarihler: [{ ay: '12', yil: '2035' }],
    });
  });
  it('hatalı ve birden fazla numarayı otomatik tek karta dönüştürmez', () => {
    expect(kartMetnindenAlanlar('4242424242424241').numaralar).toEqual([]);
    expect(kartMetnindenAlanlar('4242424242424242\n5555555555554444').numaralar).toHaveLength(2);
    expect(() => kartMetnindenAlanlar('x'.repeat(100001))).toThrow();
  });
  it('PNG boyutunu çözmeden okur; aşırı piksel ve sahte görüntüyü reddeder', () => {
    const png = new Uint8Array(32);
    const v = new DataView(png.buffer);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    png.set([73, 72, 68, 82], 12);
    v.setUint32(16, 1200);
    v.setUint32(20, 700);
    expect(kartGoruntuBoyutu(png)).toEqual({ genislik: 1200, yukseklik: 700 });
    v.setUint32(16, 30000);
    expect(() => kartGoruntuBoyutu(png)).toThrow(/megapiksel/);
    expect(() => kartGoruntuBoyutu(new TextEncoder().encode('<svg>' + 'x'.repeat(40)))).toThrow();
  });
});

describe('Kartlı caride numara düzeltmesi', () => {
  it('açık düzeltme onayı olmadan numara değişmez; onayla değişir ve kartlar aynı caride kalır', () => {
    const tc = { ...a, numara: '10000000146' };
    expect(() => profilCariKaydet(veri, tc, a)).toThrow(/numara düzeltmesi/);
    const sonuc = profilCariKaydet(veri, tc, a, true);
    expect(sonuc.cariler.find((c) => c.id === a.id)?.numara).toBe('10000000146');
    expect(sonuc.kartlar).toEqual(veri.kartlar);
  });
  it('düzeltme başka carinin numarasına çevrilemez; kartsız caride onay gerekmez', () => {
    expect(() => profilCariKaydet(veri, { ...a, numara: b.numara }, a, true)).toThrow(/zaten kayıtlı/);
    expect(profilCariKaydet(veri, { ...b, numara: '22222222222' }, b).cariler).toHaveLength(2);
  });
  it('cariye özel POS girişi saklanır, boşsa kayda yazılmaz', () => {
    const ozel = profilCariKaydet(veri, { ...a, girisKullanici: ' L77 ', girisSifresi: 'yapay' }, a);
    expect(ozel.cariler.find((c) => c.id === a.id)).toEqual({
      ...a,
      girisKullanici: 'L77',
      girisSifresi: 'yapay',
    });
    const bos = profilCariKaydet(ozel, { ...a, girisKullanici: '', girisSifresi: '' });
    expect(bos.cariler.find((c) => c.id === a.id)).toEqual(a);
    expect(() => posProfilDogrula({ ...veri, cariler: [{ ...a, girisSifresi: '' }, b] })).toThrow();
  });
});
