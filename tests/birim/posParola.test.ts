import { describe, expect, it } from 'vitest';
import {
  kasaAcilisBilgisiDogrula,
  kasaParolasiDogrula,
  yeniKasaParolasiDogrula,
  profilParolasiDogrula,
  profilParolasiGirdisi,
} from '../../src/cekirdek/posParola';

describe('Kasa PIN, parola ve yedek ayrımı', () => {
  it.each(['0274', '123456789012', 'yapay uzun kasa parolasi'])('yerel açılış bilgisini kabul eder', (p) => {
    expect(() => yeniKasaParolasiDogrula(p, p)).not.toThrow();
  });
  it.each(['', '123', '1234567890123', 'kisa-parola', ' '.repeat(20), 'a'.repeat(129)])(
    'geçersiz açılış bilgisini açıkça reddeder',
    (p) => {
      expect(() => kasaAcilisBilgisiDogrula(p)).toThrow();
    },
  );
  it('baştaki sıfır ve eski parola boşluklarını sessizce değiştirmez', () => {
    expect(() => kasaAcilisBilgisiDogrula('0274')).not.toThrow();
    expect(() => kasaParolasiDogrula(' eski yapay uzun parola ')).not.toThrow();
    expect(() => yeniKasaParolasiDogrula(' eski yapay uzun parola ', ' eski yapay uzun parola ')).toThrow(
      /boşluk/,
    );
  });
  it('tekrar yazılmamış veya farklı parola için görünür hata verir', () => {
    expect(() => yeniKasaParolasiDogrula('0274', '')).toThrow(/tekrar/);
    expect(() => yeniKasaParolasiDogrula('0274', '0275')).toThrow(/aynı/);
  });
  it('taşınabilir yedek için kısa PIN kabul etmez', () => {
    expect(() => yeniKasaParolasiDogrula('0274', '0274', true)).toThrow(/14/);
    expect(() =>
      yeniKasaParolasiDogrula('yapay uzun yedek parolasi', 'yapay uzun yedek parolasi', true),
    ).not.toThrow();
  });
});

describe('Sanal POS parolası (1.18.0)', () => {
  it('en az 10 karakter, harf ve rakam ister; boşluk ve tekrar denetlenir', () => {
    expect(() => profilParolasiDogrula('Yapay-kilit-2026', 'Yapay-kilit-2026')).not.toThrow();
    for (const [p, h] of [
      ['', /yazın/],
      ['Kisa-1', /en az 10/],
      ['sadeceharfler', /harf ve bir rakam/],
      ['1234567890', /harf ve bir rakam/],
      ['aaaaaaaaa1', /tahmin/],
      [' Yapay-kilit-2026', /boşluk/],
    ] as const)
      expect(() => profilParolasiDogrula(p, p)).toThrow(h);
    expect(() => profilParolasiDogrula('Yapay-kilit-2026', 'Yapay-kilit-2027')).toThrow(/aynı/);
    expect(() => profilParolasiGirdisi('')).toThrow(/yazın/);
  });
});
