import { oku, yaz } from './saklama';

// Yalnız tarih tutulur; cari, kart veya parola bilgisi yazılmaz.
const ANAHTAR = 'pos-son-yedek';
export const sonYedekOku = (): string | null => oku(ANAHTAR);
export const sonYedekYaz = (t: Date): void => {
  yaz(ANAHTAR, t.toISOString());
};
