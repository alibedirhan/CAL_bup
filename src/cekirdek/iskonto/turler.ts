/** Özgün Python DTO alanları korunur; hesaplar arayüzde tekrar edilmez. */
export const ISKONTO_KATEGORILERI = [
  'Bütün Piliç Ürünleri',
  'Kanat Ürünleri',
  'But Ürünleri',
  'Göğüs Ürünleri',
  'Sakatat Ürünleri',
  'Yan Ürünler',
] as const;
export type IskontoKategori = (typeof ISKONTO_KATEGORILERI)[number];
export type IskontoOranlari = Record<IskontoKategori, number>;
export interface IskontoUrunu {
  code: string;
  name: string;
  price_without_vat: number;
  price_with_vat: number;
  category: IskontoKategori;
}
export interface IskontoBelgesi {
  ad: string;
  tip: 'normal' | 'gramaj' | 'dondurulmus';
  kategoriler: Record<IskontoKategori, IskontoUrunu[]>;
}
export interface IskontoSatirRef {
  source: string;
  category: IskontoKategori;
  product_index: number;
}
export interface IskontoSatiri {
  ref: IskontoSatirRef;
  degerler: [string, IskontoKategori, string, number, number, number];
  para: [string, string, string];
}
export interface IskontoOnizlemesi {
  istatistik: {
    pdf_count: number;
    product_count: number;
    category_count: number;
    average_discount: number;
    total_discount: number;
  };
  metin: string;
  satirlar: IskontoSatiri[];
}
export type IskontoCiktiTuru = 'excel' | 'pdf' | 'paket' | 'gorunen';
export interface IskontoDosyasi {
  ad: string;
  bayt: Uint8Array;
}
export interface IskontoYuklemesi {
  belgeler: IskontoBelgesi[];
  hatalar: { ad: string; mesaj: string }[];
}

export function sifirOranlar(): IskontoOranlari {
  return Object.fromEntries(ISKONTO_KATEGORILERI.map((k) => [k, 0])) as IskontoOranlari;
}
