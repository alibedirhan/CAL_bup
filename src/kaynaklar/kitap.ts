import { KullaniciHatasi } from '../cekirdek/hata';

// Okuyucuların gördüğü Excel kitabı. Dosya kütüphanesinden (ExcelJS) bağımsızdır:
// gerçek dosya excel.ts'de, testlerde ise elle kurulan tablolarla bu biçime çevrilir.

export type HucreDegeri = string | number | boolean | Date | null;

export interface Sayfa {
  ad: string;
  /** Dolu son satır (1'den başlar). */
  sonSatir: number;
  /** Satır ve sütun 1'den başlar. Formüllü hücrede hesaplanmış değer, yoksa null. */
  hucre(satir: number, sutun: number): HucreDegeri;
  /** Birleşik hücrenin ortak kaynak adresi; okuyucu Excel kütüphanesini bilmez. */
  birlesimAnahtari?(satir: number, sutun: number): string | null;
  /** Formül var ama hesaplanmış sonuç yoksa boş miktar sayılmaz. */
  hesaplanmamisFormul?(satir: number, sutun: number): boolean;
}

export interface Kitap {
  dosyaAdi: string;
  /** Dosyanın oluşturulma zamanı (Dosya → Bilgi). */
  olusturulma: Date | null;
  sayfalar: readonly Sayfa[];
}

/** Dosyanın beklenen rapor olmadığı ya da okunamadığı durumlar. Mesaj kullanıcıya gösterilir. */
export class OkumaHatasi extends KullaniciHatasi {
  override name = 'OkumaHatasi';
}

/** Satır dizilerinden sayfa (testler ve önizlemeler için). */
export function diziSayfa(ad: string, satirlar: readonly (readonly HucreDegeri[])[]): Sayfa {
  return {
    ad,
    sonSatir: satirlar.length,
    hucre: (r, c) => satirlar[r - 1]?.[c - 1] ?? null,
  };
}
