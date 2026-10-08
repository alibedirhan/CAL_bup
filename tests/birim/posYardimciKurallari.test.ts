import { describe, expect, it } from 'vitest';
import {
  alanEngelli,
  baslikBicimi,
  ENGELLI_ALAN,
  ipucuUygun,
  tarihMetni,
} from '../../src/eklenti/alanKurallari';
import { girisMesajiTemizle } from '../../src/cekirdek/posAktarimi';
import { surumUyarisi } from '../../src/arayuz/sayfalar/pos/usePosAktarimi';
import { YARDIMCI_SURUMU } from '../../src/cekirdek/posBaglantisi';

describe('POS yardımcısı alan kuralları', () => {
  it.each([
    ['ay', 'ddlAy'],
    ['ay', 'txtAy'],
    ['ay', 'cmbSKTAy'],
    ['ay', 'ddl_ay'],
    ['ay', 'ExpMonth'],
    ['yil', 'ddlYil'],
    ['numara', 'txtKartNo'],
    ['numara', 'txtCCNo'],
    ['numara', 'txtKKNo'],
    ['numara', 'KrediKarti'],
    ['numara', 'txtPan'],
    ['numara', 'ccnumber'],
    ['numara', 'ctl00_ContentPlaceHolder1_txtKartNo'],
    ['numara', 'ctl00$ContentPlaceHolder1$txtKartNo'],
    ['tarih', 'ctl00$ContentPlaceHolder1$txtSKT'],
    ['tarih', 'txtSKT'],
    ['tarih', 'txtGecerlilik'],
    ['tarih', 'S.K.T'],
    ['tarih', 'Son Kullanma Tarihi'],
  ] as const)('%s rolü için yaygın ad kabul edilir: %s', (rol, ad) => {
    expect(ipucuUygun(ad, rol)).toBe(true);
  });
  it.each([
    ['ay', 'txtPay'],
    ['ay', 'ddlAyrinti'],
    ['numara', 'txtTutar'],
    ['numara', 'txtKartNoCvv'],
    ['numara', 'txtKrediKartiTaksit'],
    ['tarih', 'txtSktGuvenlik'],
  ] as const)('%s rolü için uygun olmayan ad reddedilir: %s', (rol, ad) => {
    expect(ipucuUygun(ad, rol)).toBe(false);
  });
  it('PIN alanlarını engeller, PIN sözcüğü içermeyen adları engellemez', () => {
    for (const ad of ['txtPin', 'PinKod', 'txtPinNumber', 'Kart PIN', 'pin'])
      expect(ENGELLI_ALAN.test(ad)).toBe(true);
    for (const ad of ['OdemeTipi_Shopping', 'lblPinar', 'txtKartNo'])
      expect(ENGELLI_ALAN.test(ad)).toBe(false);
    for (const ad of ['TL', 'Tutar TL', '100 ₺', 'txtAmount USD', '5 €'])
      expect(ENGELLI_ALAN.test(ad)).toBe(true);
    // ASP.NET ad alanları `$` içerir; bunlar tutar sayılmaz.
    for (const ad of ['Kartal', 'txtTitle', 'S.K.T', 'Kredi Kartı Numarası', 'ctl00$Icerik$txtKartNo'])
      expect(ENGELLI_ALAN.test(ad)).toBe(false);
  });
  it.each([
    ['ad', 'Ad Soyad'],
    ['ad', 'Adi Soyadi'],
    ['ad', 'txtAdSoyad'],
    ['ad', 'Kart Sahibi'],
    ['ad', 'cc-name'],
    ['cvv', 'CVV'],
    ['cvv', 'txtCvc'],
    ['cvv', 'Güvenlik Kodu'.normalize('NFD').replace(/[\u0300-\u036f]/g, '')],
    ['cvv', 'cc-csc'],
  ] as const)('%s rolü tanınır: %s', (rol, ad) => {
    expect(ipucuUygun(ad, rol)).toBe(true);
  });
  it('CVV yalnız CVV rolüne yazılır; tutar/şifre/SMS hiçbir role, e-posta Ad Soyad sayılmaz', () => {
    for (const rol of ['numara', 'tarih', 'ad'] as const) expect(alanEngelli('CVV', rol)).toBe(true);
    expect(alanEngelli('CVV', 'cvv')).toBe(false);
    for (const ad of [
      'Tutar',
      'TL',
      'SMS Kodu',
      'Şifre'.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      'txtPin',
    ])
      expect(alanEngelli(ad, 'cvv')).toBe(true);
    expect(ipucuUygun('Tanımlı E-Mail Adresi', 'ad')).toBe(false);
    expect(ipucuUygun('CVV', 'numara')).toBe(false);
  });
  it('başlık biçimi rakamları ve değişen sayıları atar', () => {
    expect(baslikBicimi('  Kredi Kartı Numarası ')).toBe('kredi karti numarasi');
    expect(baslikBicimi('S.K.T')).toBe('s.k.t');
    expect(baslikBicimi('Tutar 327.829,05 TL')).toBe(baslikBicimi('Tutar 12,00 TL'));
  });
  it('tek tarih alanının biçimini uzunluk ve yer tutucudan seçer', () => {
    expect(tarihMetni('12', '2035', 4, 'AAYY')).toBe('1235');
    expect(tarihMetni('12', '2035', 5, '')).toBe('12/35');
    expect(tarihMetni('12', '2035', -1, '')).toBe('12/35');
    expect(tarihMetni('12', '2035', 7, '')).toBe('12/2035');
    expect(tarihMetni('12', '2035', -1, 'AA/YYYY')).toBe('12/2035');
    expect(tarihMetni('12', '2035', -1, 'MM / YY')).toBe('12 / 35');
    expect(tarihMetni('12', '2035', 7, 'AA / YY')).toBe('12 / 35');
    expect(tarihMetni('12', '2035', 5, 'MM / YY')).toBe('12/35');
    expect(tarihMetni('12', '2035', 9, 'MM / YYYY')).toBe('12 / 2035');
  });
});

describe('POS giriş sonucu ve sürüm', () => {
  it('sağlayıcı yazısını kısaltır, uzun rakam dizilerini ve görünmeyen karakterleri temizler', () => {
    expect(girisMesajiTemizle('  Kullanıcı​ adı   hatalı 0123456789 ')).toBe('Kullanıcı adı hatalı •••');
    expect(girisMesajiTemizle('x'.repeat(500))).toHaveLength(120);
    expect(girisMesajiTemizle(undefined)).toBe('');
    expect(girisMesajiTemizle({ metin: 'a' })).toBe('');
  });
  it('yardımcının kendi sürümünden farklıysa güncelleme önerir (programın sürümü değil)', () => {
    expect(surumUyarisi(YARDIMCI_SURUMU)).toBe('');
    expect(surumUyarisi('0.0.1')).toContain('güncelleyin');
  });
});
