// LED biçimini birebir taklit eden sentetik kitaplar (metin sayılar, başlık satırları,
// grup satırları, çift dip toplam). Gerçek şirket verisi içermez.

import { diziSayfa, type HucreDegeri, type Kitap } from '../../src/kaynaklar/kitap';

/** 1234.5 → "1.234,500" (LED'in metin sayı biçimi) */
export function tr(x: number): string {
  const [tam, ond] = Math.abs(x).toFixed(3).split('.');
  return `${x < 0 ? '-' : ''}${(tam ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${ond}`;
}

const D01_SATIRLARI: [string, string, number][] = [
  ['K001', 'ALFA ÜRÜN', 1250.5],
  ['K002', 'BETA ÜRÜN', -0.203],
  ['K003', 'DON.GAMA DÖNER(20 KG)', 100.0],
  ['K004', 'DON.GAMA DÖNER(20 KG)', 8.68],
  ['K005', 'DON.DELTA', 30.0],
  ['K006', 'YENİ ÜRÜN', 12.0],
  ['K007', 'SIFIR ÜRÜN', 0.0],
  ['K008', 'ZETA  ÜRÜN ', 5.0],
];

export function d01Kitap(satirlar = D01_SATIRLARI): Kitap {
  const toplam = satirlar.reduce((t, [, , m]) => t + m, 0);
  const izgara: HucreDegeri[][] = [
    ['D01.Stok Giriş Çıkış Envanteri'],
    [
      'Tarih Kriteri : Fatura Tarihi\nBaşlangıç Tarihi : 01.01.2026\nBitiş Tarihi : 30.09.2026\nDepo Kartı : [3500] DEPO\n',
    ],
    [
      'Stok Kodu',
      'Stok İsmi',
      'Birimi',
      'Giren Miktar',
      'Giren Tutar',
      'Çıkan Miktar',
      'Çıkan Tutar',
      'Net Miktar',
      'Net Tutar',
    ],
    ...satirlar.map(([kod, ad, m]) => [
      kod,
      ad,
      'KG',
      tr(Math.abs(m)),
      '0,00',
      '0,000',
      '0,00',
      tr(m),
      '0,00',
    ]),
    [null, null, null, null, null, null, null, tr(toplam)],
    Array<HucreDegeri>(9).fill(' '),
    [null, null, 'KG', null, null, null, null, tr(toplam)],
  ];
  return {
    dosyaAdi: 'D01_Stok_Giriş_Çıkış_Envanteri.XLSX',
    olusturulma: null,
    sayfalar: [diziSayfa('Sheet', izgara)],
  };
}

export function sayimKitap(
  dosyaAdi = 'SAYIM_30_09.xlsx',
  olusturulma: Date | null = new Date(2026, 8, 30, 10, 31),
): Kitap {
  const izgara: HucreDegeri[][] = [
    [' ', 'Stok Kartı', 'Stok Kartı', 'Miktar', 'Birim'],
    ...(
      [
        ['K001', 'ALFA ÜRÜN', 1240.0],
        ['K002', 'BETA ÜRÜN', 0.0],
        ['K008', 'ZETA ÜRÜN', 2.0],
        ['K008', 'ZETA ÜRÜN', 3.5],
        ['K005', 'DON.DELTA', 29.0],
      ] as const
    ).map(([kod, ad, m]) => [null, kod, ad, m, 'KG']),
    [null, null, null, 1274.5], // SUBTOTAL'ın hesaplanmış hâli
  ];
  return { dosyaAdi, olusturulma, sayfalar: [diziSayfa('Sayım Fişi', izgara)] };
}

/** Aynı ürünün adetli ve kolili ambalajları; Miktar sütunu ikisinde de kilogramdır. */
export function ambalajliSayimKitap(): Kitap {
  return {
    dosyaAdi: 'SAYIM_30_09.xlsx',
    olusturulma: null,
    sayfalar: [
      diziSayfa('Sayım Fişi', [
        [' ', 'Stok Kartı', 'Stok Kartı', 'Miktar', 'Birim', 'Amb. Miktar', 'Amb. Birim'],
        [null, 'K010', 'ALFA ÜRÜN', 1.75, 'KG', 3, 'ADET'],
        [null, 'K011', 'alfa  ürün', 24, 'KG', 2, 'KOLİ'],
        [null, null, null, 25.75],
      ]),
    ],
  };
}

export function subeKitap(): Kitap {
  const izgara: HucreDegeri[][] = [
    ['Bu Piliç Dönemsel İskonto Raporu (Şube Alış)'],
    ['Başlangıç Tarihi : 29.09.2026\nBitiş Tarihi : 29.09.2026\n'],
    ['Depo', null, null, 'Stok İsim', 'Tarih', 'Stok Kodu', 'Birim', 'Miktar'],
    ['Depo:MERKEZ DEPO'],
    ...(
      [
        ['ALFA ÜRÜN', 'K001', 1000.25],
        ['BETA ÜRÜN', 'K002', 15.07],
      ] as const
    ).flatMap(([ad, kod, m]) => [
      [null, `Stok İsim:${ad}`],
      [null, null, 'MERKEZ DEPO', ad, '29.09.2026', kod, 'KG', tr(m)],
    ]),
    [null, null, null, null, null, null, null, tr(1015.32)],
  ];
  return {
    dosyaAdi: 'Bu_Piliç_Dönemsel_İskonto_Raporu__Şube_Alış_.XLSX',
    olusturulma: null,
    sayfalar: [diziSayfa('Sheet', izgara)],
  };
}

/** Hedef gün sayfasının A sütunu: DON.GAMA iki kez (gerçek dosyadaki gibi). */
export const LISTE = [
  'ALFA ÜRÜN',
  'BETA ÜRÜN',
  'DON.DELTA',
  'DON.GAMA DÖNER(20 KG)',
  'DON.GAMA DÖNER(20 KG)',
  'ZETA ÜRÜN',
];

/** Depo kontrol kitabı: iki gün sayfası ve bir de ilgisiz sayfa. */
export function depoKontrolKitap(): Kitap {
  const gun = (ad: string) =>
    diziSayfa(ad, [
      ['BAŞLIK', null, null, null, null, null, 'GELEN MAL'],
      ['29.09.2026 LED DEPO STOĞU (D01)', null, '29.09.2026 DEPO KAPANIŞ STOĞU', null, null, null, 1000],
      ['30.09.2026', null, '30.09.2026', null, 'FARK'],
      ...LISTE.map((a) => [a, 0, a, 0, 0]),
    ]);
  return {
    dosyaAdi: 'YENİ GÜNLÜK DEPO KONTROL.xlsx',
    olusturulma: null,
    sayfalar: [diziSayfa('Ana Sayfa', [['Merhaba']]), gun('29.09'), gun('30.09')],
  };
}
