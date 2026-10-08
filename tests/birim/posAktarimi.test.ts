import { expect, it } from 'vitest';
import {
  aktarimiDogrula,
  cvvDogrula,
  girisSayfasi,
  kartAktarimi,
  programAdresi,
  posSayfasi,
} from '../../src/cekirdek/posAktarimi';
import {
  eskiKurulumuDonustur,
  kurulumDogrula,
  kurulumOzeti,
  type PosKurulumu,
} from '../../src/cekirdek/posKurulumu';
const cari = { id: '11111111-1111-4111-8111-111111111111', ad: 'Yapay Cari', numara: '0123456789' };
const kart = {
  id: '22222222-2222-4222-8222-222222222222',
  cariId: cari.id,
  ad: 'Yapay Kart',
  numara: '4242424242424242',
  ay: '12',
  yil: '2035',
  sahibi: 'YAPAY KİŞİ',
  telefon: '',
  onayTarihi: '2026-10-04T00:00:00.000Z',
};
it('yalnızca seçilen carinin kartı, giriş bilgisi ve ödeme anındaki CVV ile aktarılır', () => {
  expect(kartAktarimi(cari, kart, '123')).toEqual({
    cariId: cari.id,
    kartId: kart.id,
    cariNumarasi: cari.numara,
    kullanici: cari.numara,
    sifre: '0189',
    numara: kart.numara,
    ay: '12',
    yil: '2035',
    sahibi: 'YAPAY KİŞİ',
    cvv: '123',
  });
  expect(kartAktarimi(cari, kart).cvv).toBe('');
  expect(() => kartAktarimi({ ...cari, id: kart.id }, kart)).toThrow();
});
it('kartta kayıtlı CVV kendiliğinden aktarılır; ödeme anında yazılan CVV önce gelir', () => {
  const kayitli = { ...kart, cvv: '456' };
  expect(kartAktarimi(cari, kayitli).cvv).toBe('456');
  expect(kartAktarimi(cari, kayitli, '789').cvv).toBe('789');
  expect(() => kartAktarimi(cari, kayitli, '78')).toThrow(/CVV/);
});
it('cariye özel POS giriş bilgisi varsayılan kuralın yerine geçer', () => {
  const s = kartAktarimi({ ...cari, girisKullanici: 'L-77', girisSifresi: 'yapay sır' }, kart);
  expect([s.cariNumarasi, s.kullanici, s.sifre]).toEqual([cari.numara, 'L-77', 'yapay sır']);
});
it('telefon/tutar/fazla alan, geçersiz CVV, numara ve süresi geçmiş kart reddedilir', () => {
  const s = kartAktarimi(cari, kart);
  for (const ek of [
    { telefon: '05000000000' },
    { tutar: 1 },
    { cvv: '12' },
    { cvv: '12345' },
    { cvv: '12a' },
    { numara: '4242424242424241' },
    { yil: '2020' },
    { kullanici: '' },
    { sifre: '' },
  ])
    expect(() => aktarimiDogrula({ ...s, ...ek })).toThrow();
  expect(cvvDogrula('')).toBe('');
  expect(cvvDogrula('0123')).toBe('0123');
  expect(() => cvvDogrula('١٢٣')).toThrow(/CVV/);
});
it('adresler aynı adlı başka siteleri, alt yolları ve kullanıcı bilgili adresi kabul etmez', () => {
  expect(programAdresi('https://alibedirhan.github.io/CAL_bup/#/sanal-pos')).toBe(true);
  for (const u of [
    'https://alibedirhan.github.io/baska/',
    'https://alibedirhan.github.io.evil.test/CAL_bup/',
    'http://alibedirhan.github.io/CAL_bup/',
  ])
    expect(programAdresi(u)).toBe(false);
  expect(() => posSayfasi('https://denizpay.bupilic.com.tr.evil.test/pay')).toThrow();
  expect(() => posSayfasi('https://someone@denizpay.bupilic.com.tr/pay')).toThrow();
});
it('giriş sayfası büyük/küçük harf ve oturum dönüş adresiyle de tanınır; başka site tanınmaz', () => {
  expect(girisSayfasi('https://denizpay.bupilic.com.tr/login.aspx')).toBe(true);
  expect(girisSayfasi('https://denizpay.bupilic.com.tr/Login.aspx?ReturnUrl=%2findex.aspx')).toBe(true);
  expect(girisSayfasi('https://denizpay.bupilic.com.tr/index.aspx')).toBe(false);
  expect(girisSayfasi('https://denizpay.bupilic.com.tr.evil.test/login.aspx')).toBe(false);
  expect(girisSayfasi('bozuk')).toBe(false);
});
const kurulum: PosKurulumu = {
  surum: 2,
  alanlar: {
    numara: { secici: '#kart', etiket: 'INPUT', tur: 'text', ad: 'kart', baslik: 'kredi karti numarasi' },
    tarih: { secici: '#tarih', etiket: 'INPUT', tur: 'text', baslik: 's.k.t' },
    ad: { secici: '#ad', etiket: 'INPUT', tur: 'text' },
    cvv: { secici: '#cvv', etiket: 'INPUT', tur: 'tel' },
  },
};
it('site geneli kurulum değer içermez; eksik, yinelenen, rakamlı veya fazla alan kabul edilmez', () => {
  expect(kurulumDogrula(kurulum)).toEqual(kurulum);
  expect(kurulumOzeti(kurulum)).toEqual({ ad: true, cvv: true });
  expect(kurulumOzeti(null)).toEqual({ ad: false, cvv: false });
  const a = kurulum.alanlar;
  for (const bozuk of [
    { ...kurulum, sayfa: 'https://denizpay.bupilic.com.tr/index.aspx' },
    { ...kurulum, alanlar: { ...a, numara: undefined } },
    { ...kurulum, alanlar: { ...a, tarih: a.numara } },
    { ...kurulum, alanlar: { ...a, ay: { secici: '#ay', etiket: 'SELECT', tur: '' } } },
    { ...kurulum, alanlar: { ...a, tutar: { secici: '#t', etiket: 'INPUT', tur: 'text' } } },
    { ...kurulum, alanlar: { ...a, numara: { ...a.numara, value: '4242424242424242' } } },
    { ...kurulum, alanlar: { ...a, numara: { ...a.numara, secici: '#kart123456' } } },
    { ...kurulum, alanlar: { ...a, numara: { ...a.numara, baslik: 'cari 0123' } } },
    { ...kurulum, alanlar: { ...a, cvv: { ...a.cvv, etiket: 'SELECT' } } },
    { ...kurulum, alanlar: { ...a, numara: { ...a.numara, tur: 'password' } } },
    { ...kurulum, alanlar: { ...a, firma: { secici: '#f', etiket: 'INPUT', tur: 'text' } } },
    { ...kurulum, alanlar: { ...a, firma: { secici: '#f', etiket: 'SPAN', tur: '', elle: true } } },
  ])
    expect(() => kurulumDogrula(JSON.parse(JSON.stringify(bozuk)))).toThrow();
});
it('1.15 ve öncesinin sayfa adresli kurulumu site geneli kuruluma bir kez dönüştürülür', () => {
  const eski = {
    'https://denizpay.bupilic.com.tr/login.aspx': { sayfa: 'https://denizpay.bupilic.com.tr/login.aspx' },
    'https://denizpay.bupilic.com.tr/index.aspx': {
      sayfa: 'https://denizpay.bupilic.com.tr/index.aspx',
      alanlar: {
        firma: { secici: '#firma', etiket: 'SPAN', tur: '' },
        numara: { secici: '#kart', etiket: 'INPUT', tur: 'text' },
        tarih: { secici: '#tarih', etiket: 'INPUT', tur: 'text', elle: true },
      },
    },
  };
  expect(eskiKurulumuDonustur(eski)?.alanlar.tarih?.elle).toBe(true);
  expect(eskiKurulumuDonustur({})).toBeNull();
  expect(eskiKurulumuDonustur(null)).toBeNull();
  expect(eskiKurulumuDonustur({ x: { sayfa: 'https://denizpay.bupilic.com.tr/a', alanlar: {} } })).toBeNull();
});
