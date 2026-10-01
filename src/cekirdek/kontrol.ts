// Rapordan bağımsız kontrol sonuçları (eski aracın modKontrol'ü).

import { esitMi, yuvarla3 } from './sayi';

export type Durum = 'Tamam' | 'Uyarı' | 'Hata' | 'Bilgi';

export interface Kontrol {
  ad: string;
  /** Bilgi satırında beklenen ve fark yoktur. */
  beklenen: number | null;
  bulunan: number;
  fark: number | null;
  durum: Durum;
}

export function karsilastir(ad: string, beklenen: number, bulunan: number, tolerans: number): Kontrol {
  return {
    ad,
    beklenen,
    bulunan,
    fark: yuvarla3(bulunan - beklenen),
    durum: esitMi(beklenen, bulunan, tolerans) ? 'Tamam' : 'Hata',
  };
}

export function bilgi(ad: string, deger: number): Kontrol {
  return { ad, beklenen: null, bulunan: deger, fark: null, durum: 'Bilgi' };
}

/** Hata > Uyarı > Tamam */
export function genelDurum(kontroller: readonly Kontrol[], uyariSayisi: number): 'Tamam' | 'Uyarı' | 'Hata' {
  if (kontroller.some((k) => k.durum === 'Hata')) return 'Hata';
  return uyariSayisi > 0 ? 'Uyarı' : 'Tamam';
}
