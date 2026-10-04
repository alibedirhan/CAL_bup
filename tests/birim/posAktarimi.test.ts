import { expect, it } from 'vitest';
import {
  aktarimiDogrula,
  kartAktarimi,
  programAdresi,
  posSayfasi,
  alanlariDogrula,
} from '../../src/cekirdek/posAktarimi';
const cari = { id: '11111111-1111-4111-8111-111111111111', ad: 'Yapay Cari', numara: '0123456789' };
const kart = {
  id: '22222222-2222-4222-8222-222222222222',
  cariId: cari.id,
  ad: 'Yapay Kart',
  numara: '4242424242424242',
  ay: '12',
  yil: '2035',
  sahibi: '',
  telefon: '',
  onayTarihi: '2026-10-04T00:00:00.000Z',
};
it('yalnızca seçilen carinin kartı asgari veriyle aktarılır', () => {
  expect(kartAktarimi(cari, kart)).toEqual({
    cariId: cari.id,
    kartId: kart.id,
    cariNumarasi: cari.numara,
    numara: kart.numara,
    ay: '12',
    yil: '2035',
  });
  expect(() => kartAktarimi({ ...cari, id: kart.id }, kart)).toThrow();
});
it('CVV/telefon/tutar ve geçersiz numara/süresi geçmiş kart reddedilir', () => {
  const s = kartAktarimi(cari, kart);
  for (const ek of [
    { cvv: '123' },
    { telefon: '05000000000' },
    { tutar: 1 },
    { numara: '4242424242424241' },
    { yil: '2020' },
  ])
    expect(() => aktarimiDogrula({ ...s, ...ek })).toThrow();
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
const alanlar = {
  sayfa: 'https://denizpay.bupilic.com.tr/yapay-odeme.aspx',
  alanlar: {
    firma: { secici: '#firma', etiket: 'SPAN', tur: '' },
    numara: { secici: '#kart', etiket: 'INPUT', tur: 'text' },
    tarih: { secici: '#tarih', etiket: 'INPUT', tur: 'text' },
  },
};
it('kurulum veri değeri içermez; eksik, yinelenen veya ek sır alanı kabul edilmez', () => {
  expect(alanlariDogrula(alanlar)).toEqual(alanlar);
  expect(() =>
    alanlariDogrula({ ...alanlar, alanlar: { ...alanlar.alanlar, cvv: alanlar.alanlar.numara } }),
  ).toThrow();
  expect(() =>
    alanlariDogrula({ ...alanlar, alanlar: { ...alanlar.alanlar, tarih: alanlar.alanlar.numara } }),
  ).toThrow();
  expect(() =>
    alanlariDogrula({
      ...alanlar,
      alanlar: { ...alanlar.alanlar, numara: { ...alanlar.alanlar.numara, value: '4242424242424242' } },
    }),
  ).toThrow();
});
