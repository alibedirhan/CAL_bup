import { describe, expect, it } from 'vitest';
import { esitMi, sayiCevir, sayiMetni, yuvarla3 } from '../../src/cekirdek/sayi';
import { adNormal } from '../../src/cekirdek/metin';

describe('sayiCevir', () => {
  it.each([
    ['2.854,61', 2854.61],
    ['-0,203', -0.203],
    ['0,000', 0],
    ['12.345,678', 12345.678],
    ['5.048.826,454', 5048826.454],
    ['-10,000', -10],
    [' ', 0],
    ['', 0],
    [null, 0],
    [undefined, 0],
    [12.5, 12.5],
    [7, 7],
    ['1\u00a0234,5', 1234.5],
    ['12,5 KG', 12.5],
    ['abc', 0],
  ])('%j → %d', (girdi, beklenen) => {
    expect(sayiCevir(girdi)).toBeCloseTo(beklenen, 9);
  });
});

describe('yuvarla3', () => {
  it('3 haneye yuvarlar', () => {
    expect(yuvarla3(245.1234)).toBe(245.123);
    expect(yuvarla3(245.1236)).toBe(245.124);
    expect(yuvarla3(-0.2034)).toBe(-0.203);
    expect(yuvarla3(0.1 + 0.2)).toBe(0.3);
  });

  it('yarıya yakın değerlerde Python round ile aynı sonucu verir', () => {
    // Beklenenler Python 3 round(x, 3) çıktısıdır
    expect(yuvarla3(0.0075)).toBe(0.007); // ikili gösterimde 0,00749999…
    expect(yuvarla3(0.00625)).toBe(0.006);
    expect(yuvarla3(245.1235)).toBe(245.124);
    expect(yuvarla3(2.0005)).toBe(2.001);
    expect(yuvarla3(1.0005)).toBe(1);
    expect(yuvarla3(-0.0075)).toBe(-0.007);
    expect(yuvarla3(12345.6785)).toBe(12345.678);
  });

  it('eksi sıfır üretmez', () => {
    expect(Object.is(yuvarla3(-0.0001), 0)).toBe(true);
  });
});

describe('sayiMetni', () => {
  it('Türkçe biçimde yazar', () => {
    expect(sayiMetni(12345.678)).toBe('12.345,678');
    expect(sayiMetni(-0.2)).toBe('-0,200');
  });
});

describe('esitMi', () => {
  it('tolerans içindeki farkı eşit sayar', () => {
    expect(esitMi(100, 100.001, 0.001)).toBe(true);
    expect(esitMi(100, 100.0011, 0.001)).toBe(false);
  });
});

describe('adNormal', () => {
  it('fazla boşluğu ve özel boşlukları temizler', () => {
    expect(adNormal('  ZETA  ÜRÜN\u00a0')).toBe('ZETA ÜRÜN');
    expect(adNormal('A\tB\nC')).toBe('A B C');
    expect(adNormal(null)).toBe('');
    expect(adNormal(12)).toBe('12');
  });
});
