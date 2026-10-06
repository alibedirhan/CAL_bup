/** İş hesabı özgün Python DTO'larıyla taşınır (bup/domain/yaslandirma, application/aging_analysis);
 * burada yalnız tarayıcı sözleşmesi bulunur. Alan adları kaynak DTO'larla aynıdır. */
export interface MusteriYaslandirmasi {
  cari_unvan: string;
  toplam_bakiye: number;
  bakiye_detay: Record<string, number>;
}
export interface AracYaslandirmasi {
  arac_no: string;
  musteri_sayisi: number;
  toplam_bakiye: number;
  acik_hesap: number;
  yaslanding_analizi: Record<string, number>;
  musteri_detaylari: MusteriYaslandirmasi[];
}
export interface YaslandirmaOzeti {
  vehicles: AracYaslandirmasi[];
  vehicle_count: number;
  total_customers: number;
  total_balance: number;
  total_open_account: number;
}
export interface AracDetayi {
  arac_no: string;
  musteri_sayisi: number;
  toplam_bakiye: number;
  acik_hesap: number;
  ortalama_bakiye: number;
  max_bakiye: number;
  min_bakiye: number;
  top_customers: { cari_unvan: string; toplam_bakiye: number }[];
}
export interface YaslandirmaRaporlari {
  /** Araç sırasıyla araç detayları (Özet raporu, Araç Detayı sekmesi). */
  detaylar: AracDetayi[];
  /** Toplam bakiyeye göre azalan sıra (Karşılaştırma raporu). */
  siralama: AracDetayi[];
  /** Kova sırasıyla bütün araçların kova toplamları (Yaşlandırma raporu, grafik). */
  kovalar: [string, number][];
}
export interface YaslandirmaSonucu {
  ozet: YaslandirmaOzeti;
  raporlar: YaslandirmaRaporlari;
}
export interface AracAtamasi {
  arac_no: string;
  sorumlu: string;
  email: string;
  telefon: string;
  departman: string;
  notlar: string;
  atama_tarihi: string;
}
export type AtamaGirdisi = Omit<AracAtamasi, 'atama_tarihi'>;
/** Kaynak VersionedJsonStore'un birincil ve `.bak` metinleri; nesil yalnız sekmeler arası CAS içindir. */
export interface AtamaKaydi {
  surum: 1;
  nesil: number;
  guncel: string | null;
  yedek: string | null;
}
export const bosAtamaKaydi = (): AtamaKaydi => ({ surum: 1, nesil: 0, guncel: null, yedek: null });
export interface YaslandirmaDosyasi {
  ad: string;
  bayt: Uint8Array<ArrayBuffer>;
}
export type YaslandirmaIstegi =
  | { eylem: 'analiz' | 'excel'; dosya: YaslandirmaDosyasi }
  | { eylem: 'gorunen'; dosya: YaslandirmaDosyasi; araclar: string[] }
  | { eylem: 'atama' | 'geri-al'; kayit: AtamaKaydi }
  | { eylem: 'ata'; kayit: AtamaKaydi; atama: AtamaGirdisi }
  | { eylem: 'kaldir'; kayit: AtamaKaydi; aracNo: string };
export interface AtamaDurumu {
  liste: AracAtamasi[];
  isYuku: Record<string, number>;
  geriAlinabilir: boolean;
  geriAlindi: boolean | null;
  kayit: { guncel: string | null; yedek: string | null };
}
export type YaslandirmaCevabi =
  | { tur: 'analiz'; sonuc: YaslandirmaSonucu }
  | { tur: 'dosya'; ad: string; bayt: Uint8Array<ArrayBuffer> }
  | ({ tur: 'atama' } & AtamaDurumu);
