export interface MusteriListesi {
  readonly depo: string | null;
  /** Masaüstü sözleşmesi: sıfırdan başlayan başlık satırı. */
  readonly baslikSatiri: number;
  readonly musteriler: readonly string[];
}

export type Plasiyerler = Readonly<Record<string, string>>;
export type ListeYonu = 'eksik' | 'yeni';

export interface MusteriSonucu {
  readonly eksikler: readonly string[];
  readonly yeniler: readonly string[];
  readonly eskiSayisi: number;
  readonly yeniSayisi: number;
  readonly depo: string | null;
  readonly mesaj: string;
  readonly dosyaAdi: string;
}

export interface MusteriCiktisi {
  readonly ad: string;
  readonly baslik: string | null;
  readonly satirlar: readonly string[];
  readonly yon: ListeYonu;
  readonly gorunen: boolean;
}
